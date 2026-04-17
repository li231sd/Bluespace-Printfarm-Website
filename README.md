# 3D Print Hackathon Platform

A production-ready monorepo web app for managing hackathon 3D print requests with a credit-based moderation flow.

## Stack

- Frontend: Next.js App Router + Tailwind CSS + Framer Motion
- Backend: Express + TypeScript + Prisma ORM
- Database: PostgreSQL
- Storage: Local upload folder (S3-compatible ready)
- Auth: Email/password with JWT

## Core Rules Implemented

- Every user starts with 1000 credits.
- Cost formula: `creditCost = filamentGrams * CREDIT_PER_GRAM`.
- Credits are deducted on job approval, not on submission.
- Rejections do not deduct credits; if a previously approved job is rejected, credits are refunded.
- Admin can manually add/remove credits.

## Project Structure

```text
.
|- apps/
|  |- server/                 # Express API
|  |- web/                    # Next.js frontend
|- prisma/
|  |- schema.prisma
|- scripts/
|  |- setup.ts
|  |- seed.ts
|- docker-compose.yml         # Local postgres
|- .env.example
```

## Quick Start

1. Copy environment file:
   - `cp .env.example .env`
2. Start PostgreSQL:
   - `docker compose up -d`
3. Install dependencies:
   - `npm install`
4. Generate and migrate Prisma schema:
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
5. Seed sample data:
   - `npm run prisma:seed`
6. Run both apps:
   - `npm run dev`

Frontend runs at `http://localhost:3000` and API runs at `http://localhost:4000`.

## Auth & Roles

- Register/login at `/auth`.
- If signup email matches `ADMIN_EMAIL`, user receives admin role.

Seed credentials:

- Admin: `manager@hackathon.dev` / `Admin1234`
- User: `alice@hackathon.dev` / `User12345`

## API Highlights

- `POST /api/users/signup`
- `POST /api/users/login`
- `GET /api/users/me`
- `POST /api/jobs/upload` (STL/OBJ validation)
- `POST /api/jobs` (create pending submission)
- `GET /api/jobs/mine`
- `GET /api/jobs` (admin)
- `PATCH /api/jobs/:id/approve` (deduct credits)
- `PATCH /api/jobs/:id/reject` (refund if needed)
- `PATCH /api/jobs/:id/status`
- `PATCH /api/jobs/:id/estimate`
- `GET /api/jobs/analytics/summary`
- `GET /api/credits/mine`
- `POST /api/credits/adjust` (admin)

## Environment Variables

Use `.env.example` as source of truth. Important values:

- `DATABASE_URL`
- `NEXT_PUBLIC_API_URL`
- `WEB_ORIGIN`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `CREDIT_PER_GRAM`
- `MAX_UPLOAD_MB`
- `STORAGE_MODE`
- `UPLOAD_DIR`

## Notes

- Storage mode currently saves validated files locally under `storage/uploads` and serves them via `/uploads/*`.
- You can switch to true S3 mode by extending `storage.service.ts` with AWS SDK upload operations.
