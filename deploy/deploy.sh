#!/usr/bin/env bash
#
# Alvora Bourse — one-shot deployment.
#
# Provisions everything the platform needs on a fresh Debian/Ubuntu host and is
# safe to re-run: it updates in place instead of duplicating. Secrets generated
# on the first run are preserved on every later run.
#
#   sudo ./deploy/deploy.sh --domain bourso.forgenet.fr --email you@example.com
#
# Flags:
#   --domain <host>      public hostname (default: bourso.forgenet.fr)
#   --email <address>    contact address for Let's Encrypt (required for TLS)
#   --no-tls             skip certbot; serve plain HTTP (local or behind another proxy)
#   --with-redis         provision Redis and enable the Socket.IO Redis adapter
#   --skip-deps          do not touch apt (everything is already installed)
#   --skip-build         reuse the existing build output
#   --skip-seed          do not run the asset seed
#   --dry-run            print what would happen without changing anything
#
set -Eeuo pipefail

# --------------------------------------------------------------------------
# Defaults & argument parsing
# --------------------------------------------------------------------------

DOMAIN="bourso.forgenet.fr"
EMAIL=""
USE_TLS=1
WITH_REDIS=0
SKIP_DEPS=0
SKIP_BUILD=0
SKIP_SEED=0
DRY_RUN=0

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
STATE_DIR="${ROOT_DIR}/.deploy"
LOG_DIR="${ROOT_DIR}/logs"

DB_NAME="alvora"
DB_USER="alvora"
PM2_API="alvora-api"
PM2_WEB="alvora-web"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:?--domain needs a value}"; shift 2 ;;
    --email) EMAIL="${2:?--email needs a value}"; shift 2 ;;
    --no-tls) USE_TLS=0; shift ;;
    --with-redis) WITH_REDIS=1; shift ;;
    --skip-deps) SKIP_DEPS=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --skip-seed) SKIP_SEED=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# --------------------------------------------------------------------------
# Output helpers
# --------------------------------------------------------------------------

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_DIM=$'\033[2m'
else
  C_RESET=""; C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_DIM=""
fi

step()  { printf '\n%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
info()  { printf '    %s\n' "$*"; }
ok()    { printf '    %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '    %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
die()   { printf '\n%serreur:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

run() {
  if (( DRY_RUN )); then
    printf '    %s[dry-run]%s %s\n' "$C_DIM" "$C_RESET" "$*"
  else
    "$@"
  fi
}

trap 'die "échec à la ligne $LINENO (commande: $BASH_COMMAND)"' ERR

# --------------------------------------------------------------------------
# Preflight
# --------------------------------------------------------------------------

step "Vérifications préalables"

[[ $EUID -eq 0 ]] || die "ce script doit être lancé en root (sudo ./deploy/deploy.sh)"
[[ -f "${ROOT_DIR}/package.json" ]] || die "package.json introuvable — lancez le script depuis le dépôt Alvora"

if (( USE_TLS )) && [[ -z "$EMAIL" ]]; then
  die "--email est requis pour obtenir un certificat TLS (ou utilisez --no-tls)"
fi

if [[ ! -f /etc/debian_version ]]; then
  warn "distribution non-Debian détectée : l'installation des paquets sera ignorée"
  SKIP_DEPS=1
fi

mkdir -p "$STATE_DIR" "$LOG_DIR"
ok "domaine cible : ${DOMAIN}"

# --------------------------------------------------------------------------
# System packages
# --------------------------------------------------------------------------

have() { command -v "$1" >/dev/null 2>&1; }

install_node() {
  if have node; then
    local major
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if (( major >= 20 )); then
      ok "Node.js $(node -v) déjà présent"
      return
    fi
    warn "Node.js $(node -v) est trop ancien (20+ requis), mise à jour"
  fi
  info "installation de Node.js 22 via NodeSource"
  run bash -c 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -'
  run apt-get install -y nodejs
}

if (( SKIP_DEPS )); then
  step "Paquets système (ignoré)"
else
  step "Paquets système"
  export DEBIAN_FRONTEND=noninteractive
  run apt-get update -qq
  run apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git build-essential openssl \
    postgresql postgresql-contrib nginx
  if (( USE_TLS )); then
    run apt-get install -y --no-install-recommends certbot python3-certbot-nginx
  fi
  if (( WITH_REDIS )); then
    run apt-get install -y --no-install-recommends redis-server
  fi
  install_node
  have pm2 || run npm install -g pm2@latest
  ok "paquets installés"
fi

for binary in node npm psql nginx; do
  have "$binary" || die "$binary est introuvable après l'installation"
done
have pm2 || die "pm2 est introuvable — installez-le avec: npm install -g pm2"

# --------------------------------------------------------------------------
# Port allocation
# --------------------------------------------------------------------------

port_in_use() {
  # ss is in iproute2 and present on every modern Debian; fall back to /proc.
  if have ss; then
    ss -ltnH "sport = :$1" 2>/dev/null | grep -q . && return 0 || return 1
  fi
  grep -qi ":$(printf '%04X' "$1") " /proc/net/tcp /proc/net/tcp6 2>/dev/null
}

# Reuse the port already recorded in .env so a redeploy does not wander.
find_free_port() {
  local preferred="$1" limit="${2:-200}" candidate="$preferred"
  for (( i = 0; i < limit; i++ )); do
    if ! port_in_use "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
    candidate=$(( candidate + 1 ))
  done
  die "aucun port libre trouvé à partir de ${preferred}"
}

# --------------------------------------------------------------------------
# Environment file
# --------------------------------------------------------------------------

step "Configuration (.env)"

# Read a key from the existing .env so secrets survive a redeploy.
env_get() {
  [[ -f "$ENV_FILE" ]] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed 's/^"//; s/"$//'
}

gen_secret() { openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-56; }

DB_PASSWORD="$(env_get DB_PASSWORD)"
[[ -n "$DB_PASSWORD" ]] || DB_PASSWORD="$(gen_secret)"
JWT_SECRET="$(env_get JWT_SECRET)"
[[ -n "$JWT_SECRET" ]] || JWT_SECRET="$(gen_secret)"

EXISTING_API_PORT="$(env_get API_PORT)"
EXISTING_WEB_PORT="$(env_get WEB_PORT)"
EXISTING_DB_PORT="$(env_get DB_PORT)"

API_PORT="${EXISTING_API_PORT:-$(find_free_port 4000)}"
WEB_PORT="${EXISTING_WEB_PORT:-$(find_free_port 3000)}"

ok "API sur le port ${API_PORT}, web sur le port ${WEB_PORT}"

# --------------------------------------------------------------------------
# PostgreSQL
# --------------------------------------------------------------------------

step "PostgreSQL"

PG_VERSION="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -n 1 || true)"
[[ -n "$PG_VERSION" ]] || die "aucun cluster PostgreSQL trouvé dans /etc/postgresql"

PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
CLUSTER_PORT="$(sed -n "s/^[[:space:]]*port[[:space:]]*=[[:space:]]*\([0-9]\+\).*/\1/p" "$PG_CONF" | tail -n 1)"
CLUSTER_PORT="${CLUSTER_PORT:-5432}"

if [[ -n "$EXISTING_DB_PORT" && "$EXISTING_DB_PORT" != "$CLUSTER_PORT" ]]; then
  warn "le .env pointe vers le port ${EXISTING_DB_PORT} mais le cluster écoute sur ${CLUSTER_PORT}"
fi

# Start the cluster if it is down. If its configured port is taken by something
# else, move the cluster to a free one rather than fighting over 5432 — this is
# what lets Alvora share a host with another Postgres or a Pterodactyl node.
if ! pg_isready -q -p "$CLUSTER_PORT" 2>/dev/null; then
  if port_in_use "$CLUSTER_PORT"; then
    NEW_PORT="$(find_free_port $(( CLUSTER_PORT + 1 )))"
    warn "le port ${CLUSTER_PORT} est occupé par un autre service, bascule du cluster vers ${NEW_PORT}"
    run sed -i "s/^[[:space:]]*port[[:space:]]*=.*/port = ${NEW_PORT}/" "$PG_CONF"
    CLUSTER_PORT="$NEW_PORT"
  fi
  info "démarrage du cluster PostgreSQL ${PG_VERSION}"
  run pg_ctlcluster "$PG_VERSION" main start || run systemctl start postgresql
  sleep 2
fi

DB_PORT="$CLUSTER_PORT"
if (( ! DRY_RUN )); then
  pg_isready -q -p "$DB_PORT" || die "PostgreSQL ne répond pas sur le port ${DB_PORT}"
fi
ok "PostgreSQL ${PG_VERSION} écoute sur le port ${DB_PORT}"

psql_super() { su postgres -c "psql -p ${DB_PORT} -tAc \"$1\""; }

if (( DRY_RUN )); then
  info "[dry-run] création du rôle ${DB_USER} et de la base ${DB_NAME}"
else
  if [[ "$(psql_super "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" != "1" ]]; then
    info "création du rôle ${DB_USER}"
    psql_super "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}'" >/dev/null
  else
    # Re-apply the password so .env and the database can never drift apart.
    psql_super "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}'" >/dev/null
  fi

  if [[ "$(psql_super "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]]; then
    info "création de la base ${DB_NAME}"
    su postgres -c "createdb -p ${DB_PORT} -O ${DB_USER} ${DB_NAME}"
  fi
  psql_super "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER}" >/dev/null
fi
ok "base ${DB_NAME} prête"

DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}"

# --------------------------------------------------------------------------
# Redis (optional)
# --------------------------------------------------------------------------

REDIS_URL=""
if (( WITH_REDIS )); then
  step "Redis"
  REDIS_PORT="$(env_get REDIS_PORT)"
  if [[ -z "$REDIS_PORT" ]]; then
    REDIS_PORT="$(find_free_port 6379)"
  fi
  REDIS_CONF="/etc/redis/redis.conf"
  if [[ -f "$REDIS_CONF" ]]; then
    CURRENT_REDIS_PORT="$(sed -n 's/^port \([0-9]\+\)/\1/p' "$REDIS_CONF" | tail -n 1)"
    if [[ "$CURRENT_REDIS_PORT" != "$REDIS_PORT" ]]; then
      run sed -i "s/^port .*/port ${REDIS_PORT}/" "$REDIS_CONF"
    fi
    # Bind to loopback only: the Socket.IO adapter is the only consumer.
    run sed -i "s/^bind .*/bind 127.0.0.1 -::1/" "$REDIS_CONF"
    run systemctl enable --now redis-server
    run systemctl restart redis-server
  fi
  REDIS_URL="redis://127.0.0.1:${REDIS_PORT}"
  ok "Redis sur le port ${REDIS_PORT}"
fi

# --------------------------------------------------------------------------
# Write .env
# --------------------------------------------------------------------------

PUBLIC_ORIGIN="http$( (( USE_TLS )) && printf 's')://${DOMAIN}"

if (( DRY_RUN )); then
  info "[dry-run] écriture de ${ENV_FILE}"
else
  umask 077
  cat > "$ENV_FILE" <<ENVEOF
# Généré par deploy/deploy.sh — ne pas committer.
# Les secrets sont conservés d'un déploiement à l'autre.
NODE_ENV=production

DOMAIN=${DOMAIN}
PUBLIC_ORIGIN=${PUBLIC_ORIGIN}

API_HOST=127.0.0.1
API_PORT=${API_PORT}
WEB_PORT=${WEB_PORT}

DB_PORT=${DB_PORT}
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=${DATABASE_URL}
DATABASE_POOL_MAX=20

REDIS_URL=${REDIS_URL}

JWT_SECRET=${JWT_SECRET}
COOKIE_DOMAIN=${DOMAIN}
SECURE_COOKIES=$( (( USE_TLS )) && printf 'true' || printf 'false')
CORS_ORIGINS=${PUBLIC_ORIGIN}
TRUST_PROXY=true

LOG_LEVEL=info
ENGINE_ENABLED=true

NEXT_PUBLIC_API_URL=${PUBLIC_ORIGIN}/api
NEXT_PUBLIC_WS_URL=${PUBLIC_ORIGIN}
NEXT_PUBLIC_SITE_NAME=Alvora
ENVEOF
  chmod 600 "$ENV_FILE"
  umask 022
fi
ok ".env écrit (droits 600)"

# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

if (( SKIP_BUILD )); then
  step "Compilation (ignorée)"
else
  step "Installation des dépendances et compilation"
  cd "$ROOT_DIR"
  if [[ -f package-lock.json ]]; then
    run npm ci --no-audit --no-fund
  else
    run npm install --no-audit --no-fund
  fi
  run npm run build
  ok "compilation terminée"
fi

# --------------------------------------------------------------------------
# Migrations & seed
# --------------------------------------------------------------------------

step "Base de données : migrations"
cd "$ROOT_DIR"
run env DATABASE_URL="$DATABASE_URL" npm run db:migrate
ok "migrations appliquées"

if (( SKIP_SEED )); then
  info "seed ignoré (--skip-seed)"
else
  run env DATABASE_URL="$DATABASE_URL" npm run db:seed
  ok "actifs initialisés"
fi

# --------------------------------------------------------------------------
# pm2
# --------------------------------------------------------------------------

step "pm2"

if (( DRY_RUN )); then
  info "[dry-run] démarrage de ${PM2_API} et ${PM2_WEB}"
else
  cd "$ROOT_DIR"
  # `startOrReload` gives a zero-downtime reload when the apps already run and a
  # cold start when they do not, so the same command works on every deploy.
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env
  pm2 save
  # Regenerate the systemd unit so the stack survives a reboot.
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || warn "pm2 startup a échoué (démarrage auto non configuré)"
  systemctl enable pm2-root >/dev/null 2>&1 || true
fi
ok "processus gérés par pm2 (${PM2_API}, ${PM2_WEB})"

# --------------------------------------------------------------------------
# nginx
# --------------------------------------------------------------------------

step "nginx"

NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}"

if (( DRY_RUN )); then
  info "[dry-run] écriture de ${NGINX_SITE}"
else
  sed -e "s|@DOMAIN@|${DOMAIN}|g" \
      -e "s|@API_PORT@|${API_PORT}|g" \
      -e "s|@WEB_PORT@|${WEB_PORT}|g" \
      "${SCRIPT_DIR}/nginx.conf.template" > "$NGINX_SITE"
  ln -sfn "$NGINX_SITE" "$NGINX_LINK"
  # The stock default site answers on port 80 for every unmatched host and will
  # shadow ours on a fresh install.
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx || systemctl restart nginx
fi
ok "nginx configuré pour ${DOMAIN}"

# --------------------------------------------------------------------------
# TLS
# --------------------------------------------------------------------------

if (( ! USE_TLS )); then
  step "TLS (ignoré : --no-tls)"
elif (( DRY_RUN )); then
  step "TLS"
  info "[dry-run] certbot --nginx -d ${DOMAIN}"
else
  step "TLS (Let's Encrypt)"
  if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
    info "certificat déjà présent, renouvellement si nécessaire"
    certbot renew --quiet --nginx || warn "le renouvellement a échoué, le certificat actuel reste en place"
  else
    # --redirect makes certbot add the HTTP→HTTPS redirect to our server block.
    if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect; then
      ok "certificat émis pour ${DOMAIN}"
    else
      warn "certbot a échoué — le site reste accessible en HTTP."
      warn "Vérifiez que ${DOMAIN} pointe bien vers cette machine et que le port 80 est ouvert, puis relancez."
    fi
  fi
  systemctl reload nginx || true
  # certbot installs its own systemd timer; make sure it is armed.
  systemctl enable --now certbot.timer >/dev/null 2>&1 || true
fi

# --------------------------------------------------------------------------
# Health check
# --------------------------------------------------------------------------

if (( ! DRY_RUN )); then
  step "Vérification"
  for attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
      ok "l'API répond sur le port ${API_PORT}"
      break
    fi
    if (( attempt == 30 )); then
      warn "l'API n'a pas répondu après 30 s — inspectez: pm2 logs ${PM2_API}"
    fi
    sleep 1
  done

  for attempt in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${WEB_PORT}/" 2>/dev/null; then
      ok "le site répond sur le port ${WEB_PORT}"
      break
    fi
    if (( attempt == 30 )); then
      warn "le site n'a pas répondu après 30 s — inspectez: pm2 logs ${PM2_WEB}"
    fi
    sleep 1
  done
fi

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------

cat <<SUMMARY

${C_GREEN}Alvora Bourse est déployé.${C_RESET}

  URL            ${PUBLIC_ORIGIN}
  API            ${PUBLIC_ORIGIN}/api  (127.0.0.1:${API_PORT})
  WebSocket      ${PUBLIC_ORIGIN}/ws
  PostgreSQL     127.0.0.1:${DB_PORT}/${DB_NAME}$( [[ -n "$REDIS_URL" ]] && printf '\n  Redis          %s' "$REDIS_URL")

  Journaux       pm2 logs ${PM2_API} | pm2 logs ${PM2_WEB}
  État           pm2 status
  Redémarrage    pm2 reload deploy/ecosystem.config.cjs
  Mise à jour    git pull && sudo ./deploy/deploy.sh --domain ${DOMAIN}$( (( USE_TLS )) && printf ' --email %s' "$EMAIL")

  Pour créer le premier administrateur, ajoutez ADMIN_EMAIL et ADMIN_PASSWORD
  dans .env puis relancez: pm2 reload ${PM2_API} --update-env

SUMMARY
