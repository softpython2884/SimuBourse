# SimuBourse - Simulation Financière Immersive

SimuBourse est une plateforme de simulation financière avancée conçue pour offrir une expérience de trading et d'investissement riche et dynamique. Construite avec Next.js, Genkit pour l'IA, et Drizzle ORM, elle permet aux joueurs de trader des actions, de créer et gérer leurs propres entreprises, de parier sur des événements, et bien plus encore.

Ce guide vous accompagnera pas à pas pour installer et lancer l'application sur votre machine.

**Lien du projet :** [https://github.com/softpython2884/SimuBourse.git](https://github.com/softpython2884/SimuBourse.git)

## Table des Matières

- [Fonctionnalités Clés](#fonctionnalités-clés)
- [Stack Technique](#stack-technique)
- [Démarrage Rapide](#démarrage-rapide)
  - [1. Prérequis](#1-prérequis)
  - [2. Installation du Projet](#2-installation-du-projet)
  - [3. Configuration de l'Environnement (.env)](#3-configuration-de-lenvironnement-env)
  - [4. Initialisation de la Base de Données](#4-initialisation-de-la-base-de-données)
  - [5. Lancer l'Application](#5-lancer-lapplication)

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

### 1. Prérequis

Avant de commencer, assurez-vous d'avoir les éléments suivants installés sur votre ordinateur :

- **Node.js :** Version 18 ou supérieure. Vous pouvez le télécharger sur [nodejs.org](https://nodejs.org/).
- **npm** (ou yarn) : Inclus avec Node.js.
- **Git :** Pour cloner le projet. [Télécharger Git](https://git-scm.com/downloads).
- **Une base de données PostgreSQL :** L'application a besoin d'une base de données PostgreSQL pour fonctionner. Vous avez deux options principales :
  - **Docker (Recommandé) :** Si vous avez [Docker Desktop](https://www.docker.com/products/docker-desktop/), c'est la méthode la plus simple pour lancer une base de données localement.
  - **Service Hébergé :** Vous pouvez utiliser un service de base de données en ligne comme [Supabase](https://supabase.com/), [Neon](https://neon.tech/), ou [Vercel Postgres](https://vercel.com/storage/postgres).

### 2. Installation du Projet

Ouvrez votre terminal et suivez ces commandes :

```bash
# 1. Clonez le projet depuis GitHub
git clone https://github.com/softpython2884/SimuBourse.git

# 2. Accédez au dossier du projet
cd SimuBourse

# 3. Installez toutes les dépendances nécessaires
npm install
```

### 3. Configuration de l'Environnement (.env)

Ce fichier contiendra vos clés secrètes. Il n'est pas partagé sur GitHub pour des raisons de sécurité.

**a. Créez le fichier :**
À la racine du projet `SimuBourse`, créez un nouveau fichier nommé `.env`.

**b. Remplissez le fichier :**
Copiez et collez le modèle suivant dans votre fichier `.env`, puis remplacez les valeurs par vos propres informations.

```env
# URL de connexion à votre base de données PostgreSQL
# Remplacez les valeurs par les vôtres.
# Format : postgres://UTILISATEUR:MOT_DE_PASSE@HOTE:PORT/NOM_DE_LA_BASE
DATABASE_URL="postgres://pterodactyl:Pl3453Ch4n63M3!@pods.forgenet.fr:5432/pterodactyl"

# Clé API pour Google AI (utilisée par Genkit)
# Obtenez-en une gratuitement sur https://makersuite.google.com/
GOOGLE_API_KEY="VOTRE_CLE_API_GOOGLE_AI"

# Clé secrète pour la session (utilisez une chaîne de caractères longue et aléatoire)
# Vous pouvez en générer une ici : https://generate-secret.vercel.app/32
JWT_SECRET_KEY="VOTRE_CLE_SECRETE_POUR_JWT"
```

### 4. Initialisation de la Base de Données

Maintenant que votre application sait comment se connecter à votre base de données (grâce au fichier `.env`), nous devons y créer les tables (`users`, `assets`, etc.).

**Lancez la commande suivante dans votre terminal :**

```bash
npm run db:push
```

Cette commande lit le schéma défini dans `src/lib/db/schema.ts` et crée automatiquement toute la structure nécessaire dans votre base de données PostgreSQL. **Vous ne devez exécuter cette commande qu'une seule fois lors de la première installation.**

### 5. Lancer l'Application

Vous y êtes presque ! Vous pouvez maintenant lancer l'application.

#### Mode Développement
Idéal pour développer. Le site se rechargera automatiquement à chaque modification du code.

```bash
npm run dev
```
L'application sera disponible sur `http://localhost:9002`.

#### Mode Production
Compile l'application pour des performances optimales. C'est le mode à utiliser pour un déploiement public.

```bash
npm run prod
```
Cette commande exécute `next build` puis `next start`. L'application sera également disponible sur `http://localhost:9002` (par défaut).

### ** Attentions, je crois qu'il faut une config postgres spécifique, sinon les info tel que les prix ne sont pas save ! **
