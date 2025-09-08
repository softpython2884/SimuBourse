# SimuBourse - Simulation Financière Immersive

SimuBourse est une plateforme de simulation financière avancée conçue pour offrir une expérience de trading et d'investissement riche et dynamique. Construite avec Next.js, Genkit pour l'IA, et Drizzle ORM, elle permet aux joueurs de trader des actions, de créer et gérer leurs propres entreprises, de parier sur des événements, et bien plus encore.

## Table des Matières

- [Fonctionnalités Clés](#fonctionnalités-clés)
- [Stack Technique](#stack-technique)
- [Démarrage Rapide](#démarrage-rapide)
  - [Prérequis](#prérequis)
  - [1. Installation](#1-installation)
  - [2. Configuration de l'Environnement](#2-configuration-de-lenvironnement)
  - [3. Initialisation de la Base de Données](#3-initialisation-de-la-base-de-données)
  - [4. Lancer l'Application](#4-lancer-lapplication)

## Fonctionnalités Clés

- **Marché Dynamique :** Simulation en temps réel des prix pour les actions, les cryptomonnaies, et les matières premières.
- **Gestion d'Entreprises :** Créez votre propre entreprise, gérez sa trésorerie, ses actifs, et décidez de la mettre en bourse (IPO) pour la rendre publique.
- **Fonctionnalités IA avec Genkit :**
  - **Actualités Générées par l'IA :** Des événements de marché plausibles créés dynamiquement pour chaque actif.
  - **Conseiller en Investissement IA :** Analysez des articles pour recevoir des recommandations d'investissement personnalisées.
  - **Bot de Trading Automatique :** Laissez une IA gérer votre portefeuille et exécuter des transactions stratégiques pour vous.
- **Marché des Paris :** Pariez sur l'issue d'événements futurs, qu'ils soient créés par des joueurs ou par l'IA.
- **Minage de Cryptomonnaies :** Achetez du matériel de minage virtuel et générez des récompenses passives en Bitcoin.
- **Progressive Web App (PWA) :** Installez l'application sur votre bureau ou votre téléphone pour une expérience plus rapide et immersive.

## Stack Technique

- **Framework :** [Next.js](https://nextjs.org/) (avec App Router)
- **Intelligence Artificielle :** [Genkit](https://firebase.google.com/docs/genkit)
- **Base de Données & ORM :** [PostgreSQL](https://www.postgresql.org/) avec [Drizzle ORM](https://orm.drizzle.team/)
- **UI :** [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Composants :** [ShadCN/UI](https://ui.shadcn.com/)

## Démarrage Rapide

Suivez ces étapes pour lancer l'application sur votre machine locale.

### Prérequis

- Node.js (v18 ou supérieure)
- npm ou yarn
- Une base de données PostgreSQL accessible. Vous pouvez en utiliser une hébergée ou en lancer une localement via Docker.

### 1. Installation

Clonez le projet et installez les dépendances :

```bash
# Si vous n'avez pas encore le projet
git clone https://github.com/votre-repo/simubourse.git
cd simubourse

# Installation des paquets
npm install
```

### 2. Configuration de l'Environnement

Créez un fichier `.env` à la racine du projet. C'est ici que vous stockerez vos clés secrètes et vos informations de connexion.

**Copiez et collez le modèle suivant dans votre fichier `.env` :**

```env
# URL de connexion à votre base de données PostgreSQL
# Format : postgres://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgres://pterodactyl:Pl3453Ch4n63M3!@pods.forgenet.fr:5432/pterodactyl"

# Clé API pour Google AI (Genkit)
# Obtenez-en une sur https://makersuite.google.com/
GOOGLE_API_KEY="VOTRE_CLE_API_GOOGLE_AI"

# Clé secrète pour la session JWT (utilisez une chaîne de caractères longue et aléatoire)
# Vous pouvez en générer une ici : https://generate-secret.vercel.app/32
JWT_SECRET_KEY="VOTRE_CLE_SECRETE_POUR_JWT"
```
**Important :** Remplacez les valeurs `VOTRE_...` par vos propres clés. Ne partagez jamais ce fichier.

### 3. Initialisation de la Base de Données

Une fois votre `DATABASE_URL` correctement configurée dans le fichier `.env`, vous devez créer la structure de la base de données (les tables, les relations, etc.).

**Lancez la commande suivante dans votre terminal :**

```bash
npm run db:push
```

Cette commande va lire le schéma défini dans `src/lib/db/schema.ts` et créer toutes les tables nécessaires dans votre base de données PostgreSQL. Vous ne devez faire cette commande qu'une seule fois lors de l'installation initiale.

### 4. Lancer l'Application

Vous pouvez lancer l'application en deux modes :

#### Mode Développement
Idéal pour développer, avec rechargement à chaud à chaque modification du code.

```bash
npm run dev
```
L'application sera disponible sur `http://localhost:9002`.

#### Mode Production
Compile l'application pour des performances optimales. C'est le mode que vous utiliseriez pour un déploiement public.

```bash
npm run prod
```
Cette commande exécute `next build` puis `next start`. L'application sera également disponible sur `http://localhost:9002` (par défaut).
```