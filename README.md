# Bluespace Printfarm Website

Monorepo for the Bluespace print farm platform.

## Project Structure

- `apps/web` - Next.js frontend
- `apps/server` - Express API
- `prisma` - database schema and migrations
- `docker-compose.yml` - local PostgreSQL service

## Requirements

- Node.js 22
- npm 10
- Docker, if you want to run PostgreSQL locally

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Create a `.env` file at the repo root with the values your app needs, including database and auth settings.

4. Run database setup:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Start the app:

```bash
npm run dev
```

## Scripts

- `npm run dev` - run web and server in parallel
- `npm run build` - build all workspaces
- `npm run lint` - lint all workspaces
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - run Prisma migrations
- `npm run prisma:seed` - seed the database

## Ports

- Web: `http://localhost:3000`
- API: `http://localhost:4000`