# Customer Support Ticket System (CSTS) — Backend

NestJS API for a customer support ticket system.

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL 14+ running locally

## Getting started

1. Copy the environment file and adjust values if needed:

   ```bash
   cp .env.example .env
   ```

   Default local database settings:

   | Variable | Default |
   | --- | --- |
   | `PORT` | `3000` |
   | `DB_HOST` | `localhost` |
   | `DB_PORT` | `5432` |
   | `DB_USERNAME` | `postgres` |
   | `DB_PASSWORD` | `postgres` |
   | `DB_NAME` | `csts` |
   | `DB_SYNC` | `true` |
   | `GEMINI_API_KEY` | (required for ticket classification and similar-ticket search) |
   | `GEMINI_MODEL` | `gemini-3.6-flash` |
   | `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` |

   `DB_SYNC=true` is for this empty bootstrap only. Set it to `false` in production and use TypeORM migrations instead.

2. Create the PostgreSQL database:

   ```sql
   CREATE DATABASE csts;
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Run migrations, then seed demo users, tickets, and comments:

   ```bash
   npm run migration:run
   npm run seed
   ```

5. Start the API in watch mode:

   ```bash
   npm run start:dev
   ```

## Endpoints

| Resource | URL |
| --- | --- |
| Health check | [http://localhost:3000/api](http://localhost:3000/api) |
| Swagger UI | [http://localhost:3000/api/docs](http://localhost:3000/api/docs) |

The global API prefix is `/api`.

## Seed data

`npm run seed` is idempotent: if `admin@csts.local` already exists it skips. Use `npm run seed:reset` to truncate users, tickets, and comments, reset the ticket-number sequence, and insert again.

Seeding is refused when `NODE_ENV=production` unless you also pass `--force` (`npm run seed -- --force`).

All seed accounts use the password `Password123!`.

| Email | Role | Notes |
| --- | --- | --- |
| `admin@csts.local` | ADMIN | Staff login; can delete tickets |
| `agent1@csts.local` | SUPPORT_AGENT | Primary assignee |
| `agent2@csts.local` | SUPPORT_AGENT | Second assignee |
| `alice@example.com` | CUSTOMER | Several tickets |
| `bob@example.com` | CUSTOMER | |
| `carol@example.com` | CUSTOMER | Inactive (`isActive: false`) |

## Project structure

```text
src/
├── app.module.ts
├── main.ts
├── auth/          # reserved
├── users/         # reserved
├── tickets/       # reserved
├── comments/      # reserved
├── common/        # reserved
└── database/
    ├── database.module.ts
    ├── data-source.ts
    ├── migrations/
    └── seeds/
```

Auth, users, tickets, and comments are not implemented yet.

## Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm run start:debug` | Start in debug watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled app |
| `npm run lint` | ESLint with `--fix` |
| `npm run test` | Unit tests (Jest) |
| `npm run migration:generate -- src/database/migrations/Name` | Generate a migration |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert the last migration |
| `npm run seed` | Insert demo users, tickets, and comments (skips if already seeded) |
| `npm run seed:reset` | Truncate users/tickets/comments and reseed |

## Docker

Dockerfile and docker-compose will be added after CRUD operations are in place.
