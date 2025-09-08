# SimuBourse - Simulation Financière Immersive

SimuBourse est une plateforme de simulation financière avancée conçue pour offrir une expérience de trading et d'investissement riche et dynamique. Construite avec Next.js, Genkit pour l'IA, et Drizzle ORM, elle permet aux joueurs de trader des actions, de créer et gérer leurs propres entreprises, de parier sur des événements, et bien plus encore.

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
- Une base de données PostgreSQL

### 1. Installation

Clonez le projet et installez les dépendances :

```bash
npm install
```

### 2. Configuration de l'Environnement

Créez un fichier `.env` à la racine du projet en vous basant sur le modèle suivant :

```env
# URL de connexion à votre base de données PostgreSQL
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DATABASE"

# Clé API pour Google AI (Genkit)
GOOGLE_API_KEY="VOTRE_CLE_API_GOOGLE_AI"

# Clé secrète pour la session JWT (utilisez une chaîne de caractères longue et aléatoire)
JWT_SECRET_KEY="VOTRE_CLE_SECRETE_POUR_JWT"
```

### 3. Initialisation de la Base de Données

Une fois votre `DATABASE_URL` configurée, lancez la commande suivante pour créer toutes les tables nécessaires :

```bash
npm run db:push
```

### 4. Lancer l'Application

Vous pouvez lancer l'application en deux modes :

**Mode Développement :**
Idéal pour le développement, avec rechargement à chaud.

```bash
npm run dev
```
L'application sera disponible sur `http://localhost:9002`.

**Mode Production :**
Compile l'application pour des performances optimales.

```bash
npm run prod
```
Cela lancera `next build` puis `next start`.