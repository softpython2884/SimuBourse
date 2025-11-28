# SimuBourse - Financial Simulation Game

Welcome to SimuBourse, an immersive financial simulation platform built with Next.js, Drizzle ORM, and Genkit for AI-powered features. Trade stocks, cryptocurrencies, create and manage your own companies, invest in others, and get investment advice from an integrated AI.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [ShadCN UI](https://ui.shadcn.com/)
- **Database**: [SQLite](https://www.sqlite.org/) via `better-sqlite3`
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Generative AI**: [Firebase Genkit](https://firebase.google.com/docs/genkit)
- **Authentication**: Custom JWT-based session management

## Getting Started

Follow these steps to get your local development environment up and running.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v20.x or higher)
- npm or another package manager

### 2. Installation

First, clone the repository and install the dependencies:

```bash
git clone <your-repository-url>
cd SimuBourse-u2 # Or your project directory
npm install
```

### 3. Environment Variables

Create a `.env` file in the root of your project. This file is for your secret keys. You will need a Google AI API key for the Genkit features to work.

```env
# Get your key from Google AI Studio: https://makersuite.google.com/app/apikey
GOOGLE_API_KEY="your_google_ai_api_key"
```

### 4. Initialize the Database

The project uses SQLite, and the database file (`sqlite.db`) will be created automatically. To set up the necessary tables, run the initialization script:

```bash
npm run db:init
```
This command only needs to be run once. It will create all the necessary tables in your `sqlite.db` file.

### 5. Run the Development Server

You're all set! Start the development server:

```bash
npm run dev
```

The application should now be running at [http://localhost:9002](http://localhost:9002).

## Available Scripts

- `npm run dev`: Starts the Next.js development server with Turbopack.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts a Next.js production server.
- `npm run lint`: Runs ESLint to check for code quality.
- `npm run db:init`: Initializes the SQLite database with the required schema.

## Deployment to a VM with PM2

To run this application in production on a Linux VM:

1.  Clone the project and install dependencies (`npm install`).
2.  Set up your `.env` file with your production `GOOGLE_API_KEY`.
3.  Build the project: `npm run build`.
4.  Use `pm2` to start and manage the application:
    ```bash
    pm2 start npm --name "simubourse" -- run start -p 3000
    ```
    This will start the app on port 3000 and ensure it restarts automatically.
