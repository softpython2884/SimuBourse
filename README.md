# SimuBourse

Plateforme de simulation financière (actions, crypto, forex, commodities, marchés de prédiction, minage, entreprises virtuelles et conseiller IA).

Construit avec Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Drizzle ORM, better-sqlite3 et Genkit (Google AI).

## Architecture

- **Base de données** : SQLite local (`sqlite.db`), créée et migrée automatiquement au démarrage. Pas de Docker ni de base externe.
- **Auth** : cookie HMAC-signé (`SESSION_SECRET`), httpOnly, sameSite=lax. Le premier utilisateur inscrit devient admin automatiquement.
- **Prix des actifs** : simulés côté serveur (tick toutes les 3s) et poussés aux clients via SSE (`/api/prices/stream`). Tous les utilisateurs voient — et tradent — au même prix.
- **Marchés de prédiction** : un cron interne (60s) ferme les marchés expirés ; quand un admin définit l'issue gagnante, les payouts (parimutuel) sont calculés et crédités automatiquement.
- **Minage** : accrual côté serveur, formule SQL atomique. Le client ne peut plus spécifier le montant à réclamer.

## Prérequis

- Node.js 20+ et npm.
- Sur la VM, il vous faut un compilateur C/C++ pour better-sqlite3 (Ubuntu : `sudo apt-get install build-essential python3`).

## Démarrage local

```bash
git clone <repo>
cd SimuBourse
npm install
cp .env.example .env

# Générer un SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Coller la valeur dans .env

npm run dev   # http://localhost:9002
```

À la première ouverture, le schéma SQLite est créé et les ~40 actifs initiaux sont seedés.

Créez le premier utilisateur via `/signup` : il sera promu **admin** automatiquement et aura accès à `/admin`.

## Déploiement sur une VM (sans Docker)

```bash
# Sur la VM (Ubuntu/Debian)
sudo apt update && sudo apt install -y build-essential python3 nodejs npm
node -v  # >= 20
git clone <repo> /opt/simubourse && cd /opt/simubourse
npm ci
cp .env.example .env && nano .env   # renseigner SESSION_SECRET et GOOGLE_GENAI_API_KEY
npm run build
NODE_ENV=production npm start       # port 3000 par défaut
```

Pour persister l'app, utilisez **pm2** ou un service systemd. Exemple systemd :

```ini
# /etc/systemd/system/simubourse.service
[Unit]
Description=SimuBourse
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/simubourse
EnvironmentFile=/opt/simubourse/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now simubourse
```

Mettre nginx en reverse-proxy devant si vous voulez SSL + un nom de domaine.

### Note importante

SQLite + WAL est mono-process : **ne lancez qu'une instance** de l'app (scale vertical uniquement). Le simulateur de prix et le resolver de marchés sont des singletons in-process — plusieurs instances créeraient des doublons.

## Scripts npm

| Script | Description |
|---|---|
| `npm run dev` | Dev server (Turbopack, port 9002, hot reload). |
| `npm run build` | Build production. |
| `npm start` | Lance le serveur production. |
| `npm run typecheck` | Vérification TypeScript sans build. |
| `npm run lint` | ESLint. |
| `npm run db:init` | Force l'init du schéma (utile si vous avez supprimé `sqlite.db`). |
| `npm run genkit:dev` | Lance le studio Genkit en local (debug des flows IA). |

## Authentification & rôles

- **Inscription** : `/signup` — crée un compte et pose le cookie de session.
- **Connexion** : `/login` — vérifie le hash bcrypt et pose le cookie.
- **Premier inscrit = admin**. Les suivants sont des `user` standard.
- **Routes protégées** par le middleware (`src/middleware.ts`) : `/`, `/portfolio`, `/profile`, `/trading`, `/markets`, `/mining`, `/companies`, `/ai-investor`, `/admin`.
- **/admin** vérifie le rôle côté serveur via le layout `app/admin/layout.tsx` et chaque action via `requireAdmin()`.

## Réinitialiser la base

Stop l'app, supprimez `sqlite.db` (et éventuellement `sqlite.db-shm`, `sqlite.db-wal`), redémarrez : le schéma est recréé et les actifs reseedés. Tous les comptes sont perdus, le premier nouveau compte devient admin.

## Backups VM

```bash
sqlite3 sqlite.db ".backup '/var/backups/simubourse-$(date +%F).db'"
```

À mettre dans un cron quotidien si le projet contient des données importantes.

## Variables d'environnement

| Nom | Requis | Description |
|---|---|---|
| `SESSION_SECRET` | Oui en prod | Clé HMAC pour signer les cookies de session. ≥ 32 octets recommandés. |
| `GOOGLE_GENAI_API_KEY` | Pour les fonctionnalités IA | Clé Google AI Studio. Sans elle, l'AI investor et la génération d'actualités tomberont en erreur (le reste de l'app fonctionne). |
| `NODE_ENV` | Auto | `production` active le cookie `secure`. |
| `PORT` | Optionnel | Port d'écoute (3000 par défaut en prod, 9002 en dev). |
