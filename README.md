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

   `DB_SYNC=true` is for this empty bootstrap only. Set it to `false` in production and use TypeORM migrations instead.

2. Create the PostgreSQL database:

   ```sql
   CREATE DATABASE csts;
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the API in watch mode:

   ```bash
   npm run start:dev
   ```

## Endpoints

| Resource | URL |
| --- | --- |
| Health check | [http://localhost:3000/api](http://localhost:3000/api) |
| Swagger UI | [http://localhost:3000/api/docs](http://localhost:3000/api/docs) |

The global API prefix is `/api`.

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
    └── migrations/
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

## Docker

Dockerfile and docker-compose will be added after CRUD operations are in place.
