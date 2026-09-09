<div align="center">

# Alvora

**Alvora Bourse** — simulation boursière multijoueur en temps réel.

Actions, cryptomonnaies, portefeuilles on-chain, entreprises cotées,
minage et marchés de prédiction — dans un seul monde partagé.

[![Licence: GPL v3](https://img.shields.io/badge/licence-GPL--3.0-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A520.11-informational)
![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-informational)

</div>

---

## Ce que c'est

Alvora est un simulateur de marché **multijoueur**. Un seul processus fait autorité sur
les prix : tout le monde voit le même marché, au même instant, et les ordres des joueurs
le font réellement bouger. Ce n'est pas une démo qui tire des nombres au hasard dans le
navigateur — c'est un moteur de marché avec un carnet d'ordres, des frais, du slippage et
un journal comptable.

### Fonctionnalités

**Marché**
- 68 instruments répartis en 7 classes : actions, cryptos, forex, matières premières,
  indices, ETF, obligations — plus les entreprises créées par les joueurs.
- Carnet d'ordres avec priorité prix-temps, exécution au prix du **passif**, et
  prévention de l'auto-exécution (impossible de se croiser soi-même pour manipuler un cours).
- Ordres au marché, à cours limité, stop, stop-limite et stop suiveur. Durées de validité
  `GTC`, `IOC`, `FOK` et `DAY`. Les stops sont **réellement exécutés** par le moteur.
- Impact de marché : un achat net déplace le prix. Le carnet n'est pas décoratif.
- Bougies OHLCV persistées sur 6 intervalles, événements de marché générés localement qui
  exercent une pression réelle sur les cours.

**Crypto**
- Portefeuilles on-chain simulés par chaîne (BTC, ETH, SOL, DOGE), avec adresse, mempool,
  confirmations par bloc et frais de réseau variables.
- Transferts entre joueurs d'adresse à adresse, carnet d'adresses, swaps avec slippage.
- Staking avec rendement au prorata du temps et pénalité de retrait anticipé.
- Minage : la récompense d'un bloc est partagée **au prorata du hashrate**, et l'électricité
  est facturée. Chaque nouvelle machine dilue tout le monde, y compris son acheteur.
- Pont explicite entre le solde d'échange et le portefeuille on-chain : les deux surfaces ne
  peuvent jamais compter les mêmes pièces deux fois.

**Entreprises**
- Création, trésorerie, rôles et permissions (`ceo`, `director`, `trader`, `member`).
- Introduction en bourse : l'action devient un vrai instrument négociable dans le carnet.
- Émission, rachat d'actions, dividendes au prorata, salaires, revenus passifs par secteur.
- Le cours d'une société cotée est ancré à ses fondamentaux : il ne peut pas s'en détacher
  indéfiniment.

**Joueurs**
- Marchés de prédiction parimutuels avec règlement exact et remboursement si personne ne
  mise sur l'issue gagnante.
- Échanges de gré à gré (OTC) sous séquestre : les deux jambes sont bloquées avant l'accord.
- Prêts avec intérêts et liquidation, intérêts sur l'épargne, classement, succès,
  notifications, chat, alertes de prix.

---

## Architecture

```
alvora/
├── packages/
│   ├── shared/          contrats zod, événements temps réel, arithmétique exacte
│   └── db/              schéma PostgreSQL (Drizzle), migrations, seed
├── apps/
│   ├── api/             Fastify + Socket.IO + moteur de simulation
│   └── web/             Next.js 16 (App Router) + React 19 + Tailwind v4
├── deploy/              deploy.sh, pm2, nginx, certbot
└── docs/                manifeste des routes de l'API
```

Le découpage n'est pas cosmétique. Le moteur doit être **un seul processus** : deux
instances signifieraient deux boucles de prix concurrentes et des blocs minés deux fois.
Le front, lui, est sans état et peut tourner en cluster sur tous les cœurs disponibles.

### Les deux décisions qui structurent tout

**1. L'argent n'est jamais un flottant.** Chaque montant, quantité et prix est un entier
exact mis à l'échelle 1e8, porté par un `bigint` et stocké en `numeric(40, 0)`. La version
précédente stockait l'argent en `real` SQL et faisait les calculs en nombres JavaScript :
c'est de là que venaient les soldes qui dérivaient et les fameux `$NaN` affichés sur les
écrans de marché. Cette classe de bug est désormais **impossible à représenter**.

```ts
import { parseDecimal, notional, toDecimalString } from '@alvora/shared';

const quantite = parseDecimal('0.12345678');
const prix = parseDecimal('67850.00');
toDecimalString(notional(quantite, prix), 2); // "8376.54", exactement, toujours
```

**2. L'argent ne bouge que par le grand livre.** Aucun code ne fait `UPDATE users SET
cash = ...`. Tout passe par `services/accounts.ts`, qui verrouille la ligne avant de lire
un solde qu'il s'apprête à modifier, et écrit une ligne de `ledger` pour chaque
mouvement. N'importe quel solde peut être reconstruit et audité.

### Temps réel

Socket.IO sur `/ws`. Le client tient **une** connexion par onglet et s'abonne à des salons :
prix, carnet d'un actif, salon privé de l'utilisateur (exécutions, notifications), chat,
classement. Le flux de prix est agrégé côté serveur — envoyer 68 actifs à pleine cadence à
chaque socket est exactement ce qui fait fondre un petit VPS.

---

## Démarrage rapide

### Prérequis

- Node.js ≥ 20.11
- PostgreSQL ≥ 14
- Redis (facultatif — améliore la montée en charge, jamais requis)

### En local

```bash
git clone https://github.com/softpython2884/SimuBourse.git alvora
cd alvora
npm install

# Base de données
sudo -u postgres createuser alvora --pwprompt
sudo -u postgres createdb -O alvora alvora

cp .env.example .env
# Renseignez DATABASE_URL et générez un JWT_SECRET :
#   openssl rand -base64 48

npm run build:packages
npm run db:migrate
npm run db:seed
npm run dev
```

Le site est sur http://localhost:3000, l'API sur http://localhost:4000.

Pour obtenir un compte administrateur, renseignez `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans
`.env` avant le premier démarrage de l'API.

### En production

Un seul script, sur une machine Debian ou Ubuntu vierge :

```bash
sudo ./deploy/deploy.sh --domain bourso.forgenet.fr --email vous@exemple.fr
```

Il installe les paquets, provisionne PostgreSQL (et **déplace le cluster sur un port libre**
si 5432 est déjà pris par autre chose), génère les secrets, applique les migrations,
compile, met en place pm2, écrit la configuration nginx avec la mise à niveau WebSocket, et
obtient le certificat TLS via certbot.

Le script est **idempotent** : relancez-le pour déployer une mise à jour. Les secrets créés
au premier passage sont relus depuis `.env`, jamais régénérés.

```bash
sudo ./deploy/deploy.sh --domain bourso.forgenet.fr --email vous@exemple.fr --with-redis
sudo ./deploy/deploy.sh --dry-run        # montre ce qui serait fait
```

| Option | Effet |
| --- | --- |
| `--domain <hôte>` | nom d'hôte public (défaut : `bourso.forgenet.fr`) |
| `--email <adresse>` | contact Let's Encrypt (requis avec TLS) |
| `--no-tls` | pas de certbot, HTTP simple |
| `--with-redis` | provisionne Redis et active l'adaptateur Socket.IO |
| `--skip-deps` / `--skip-build` / `--skip-seed` | saute une étape |
| `--dry-run` | n'exécute rien |

---

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | API et front en développement, un seul Ctrl-C |
| `npm run build` | compile les quatre paquets dans l'ordre |
| `npm run typecheck` | vérification TypeScript sur tout le dépôt |
| `npm test` | tests unitaires (arithmétique exacte, économie) |
| `npm run db:generate` | génère une migration depuis le schéma |
| `npm run db:migrate` | applique les migrations |
| `npm run db:seed` | insère l'univers d'actifs (idempotent) |

---

## Configuration

Toutes les variables sont documentées dans [`.env.example`](.env.example). Les plus
importantes :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | connexion PostgreSQL |
| `JWT_SECRET` | signature des jetons, **32 caractères minimum** |
| `REDIS_URL` | facultatif ; adaptateur Socket.IO multi-instances |
| `ENGINE_ENABLED` | `false` met le marché en pause sans arrêter l'API |
| `SECURE_COOKIES` | `true` uniquement derrière HTTPS |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | crée le premier administrateur au démarrage |

L'API refuse de démarrer si une variable est absente ou invalide, plutôt que de le
découvrir à la première requête.

Les paramètres de jeu — volatilité, frais, coûts, rendements, seuils — sont regroupés dans
[`packages/shared/src/constants.ts`](packages/shared/src/constants.ts). C'est le seul
endroit à toucher pour rééquilibrer l'économie.

---

## Sécurité

- Mots de passe hachés avec **scrypt** (`node:crypto`) : mémoire-dur, aucune compilation
  native à casser à chaque montée de version de Node.
- Jetons d'accès JWT courts en cookie `httpOnly`, jetons de rafraîchissement opaques
  **rotatifs** dont seul le SHA-256 est stocké. Rejouer un jeton révoqué invalide toute la
  chaîne de sessions du compte.
- Chaque session est vérifiée en base à chaque requête : une déconnexion, un changement de
  mot de passe ou un bannissement prend effet immédiatement.
- Validation zod sur chaque entrée. Aucun prix, frais ni total envoyé par le client n'est
  jamais accepté — tout est recalculé côté serveur.
- Limitation de débit par compte quand la requête est authentifiée, par IP sinon, avec un
  seuil plus strict sur le passage d'ordres.
- Journal d'audit horodaté sur toute action privilégiée ou touchant à l'argent.

Une faille ? Écrivez à <nightfury@nationquest.fr> plutôt que d'ouvrir une issue publique.

---

## Licence

[GNU General Public License v3.0 ou ultérieure](LICENSE).

Copyright © Night <nightfury@nationquest.fr>

Ce programme est un logiciel libre : vous pouvez le redistribuer et le modifier selon les
termes de la GPL v3. Il est distribué **sans aucune garantie**.

> Les émetteurs, cours et actualités d'Alvora sont **fictifs**. Aucune donnée de marché
> réelle n'est utilisée, et rien ici ne constitue un conseil en investissement.
