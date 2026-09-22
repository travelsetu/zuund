# zuund

Monorepo for the zuund platform: a NestJS API backed by PostgreSQL, and a React admin dashboard.

```
zuund/
├── apps/
│   ├── backend/           NestJS + Prisma API            dev http://localhost:3000/api   prod https://api.zuund.com
│   ├── admin-dashboard/   React + Vite + React Router    dev http://localhost:5173       prod https://admin.zuund.com
│   └── web/               Next.js public site            dev http://localhost:3001       prod https://zuund.com
├── packages/
│   ├── shared/            Types + zod schemas used by both apps (@zuund/shared)
│   └── tsconfig/          Base TypeScript configs (@zuund/tsconfig)
├── infra/
│   ├── nginx/             One server block per hostname, copied to the VPS on deploy
│   ├── deploy.sh          Zero-downtime deploy, run on the VPS by the GitHub workflow
│   └── rollback-admin.sh  Point admin.zuund.com back at the previous release
├── scripts/link-env.mjs   Symlinks the root .env into each app
├── ecosystem.config.cjs   pm2 processes for the API and the Next site
├── docker-compose.yml     PostgreSQL 16 with a persistent named volume (dev and prod)
├── pnpm-workspace.yaml    pnpm workspaces
└── turbo.json             Turborepo task graph
```

## Stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Runtime    | Node 24 (`.nvmrc`), pnpm 10 (`packageManager` field)      |
| Database   | PostgreSQL 16 via Docker Compose, Prisma 7 as ORM         |
| Backend    | NestJS 12, JWT auth in httpOnly cookies, argon2id hashing |
| Admin      | React 19, Vite 8, React Router 8 (plain SPA, no SSR)      |
| Web        | Next.js 16 (App Router)                                   |
| Monorepo   | pnpm workspaces + Turborepo                               |
| Validation | zod schemas shared between backend and frontend           |

### Why Turborepo on top of pnpm workspaces

pnpm workspaces handle linking and installation. Turborepo adds the two things that
matter once you have a shared package: it runs `build` for `@zuund/shared` before the
apps that depend on it (`dependsOn: ["^build"]`), and it runs `dev` for every app in
parallel with one command. It is a single dev dependency with one config file. Nx was
not worth its extra weight for a repo of this size.

## Prerequisites

- Node 24 (`nvm use` picks it up from `.nvmrc`)
- pnpm 10 (`corepack enable` or `npm i -g pnpm`)
- Docker with Compose (Docker Desktop, OrbStack, or Colima)

## First-time setup

```bash
# 1. One env file for the whole repo
cp .env.example .env

# 2. Replace the JWT secrets in .env
openssl rand -base64 48   # run twice, paste into JWT_ACCESS_SECRET and JWT_REFRESH_SECRET

# 3. Install, link .env into each app, start Postgres, generate the Prisma client, migrate, seed
pnpm bootstrap
```

`pnpm bootstrap` is shorthand for
`pnpm install && pnpm env:link && pnpm db:up && pnpm db:generate && pnpm db:migrate && pnpm db:seed`.

The seed creates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`
(defaults: `admin@example.com` / `ChangeMe123!`). It is idempotent and never overwrites an
existing user.

## Running locally

```bash
pnpm dev              # backend + dashboard + web together (Turborepo TUI; press a key to focus a task)
pnpm dev:backend      # only the API, with watch mode
pnpm dev:dashboard    # only the admin dashboard
pnpm dev:web          # only the Next.js site
```

Then open http://localhost:5173 and sign in with the seeded admin.

In development the Vite server proxies `/api/*` to the backend, so the browser talks to a
single origin and the auth cookies work without any CORS configuration.

### Database commands

| Command            | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `pnpm db:up`       | Start Postgres in the background                          |
| `pnpm db:down`     | Stop Postgres (data is kept in the `zuund_pgdata` volume) |
| `pnpm db:reset`    | Stop Postgres **and delete the volume**, then start fresh |
| `pnpm db:logs`     | Tail Postgres logs                                        |
| `pnpm db:migrate`  | `prisma migrate dev`: create/apply migrations             |
| `pnpm db:generate` | Regenerate the Prisma client after editing the schema     |
| `pnpm db:seed`     | Run `apps/backend/prisma/seed.ts`                         |
| `pnpm db:studio`   | Open Prisma Studio                                        |

Postgres is published on `127.0.0.1:5433` by default (see `POSTGRES_PORT` in `.env`) so it
does not collide with a Homebrew or system Postgres on 5432. `DATABASE_URL` must use the
same port.

### Other commands

```bash
pnpm build        # build shared → backend → dashboard
pnpm typecheck    # tsc --noEmit in every package
pnpm format       # prettier --write
```

## Authentication

- `POST /api/auth/login` `{ email, password }` verifies the argon2id hash and sets two
  httpOnly, SameSite=Lax cookies: `access_token` (15 min, path `/`) and `refresh_token`
  (7 days, path `/api/auth`).
- `GET /api/auth/me` returns the current user; guarded by `JwtAccessGuard`.
- `POST /api/auth/refresh` rotates the refresh token. Each refresh token is stored as a
  SHA-256 hash in `refresh_tokens`, revoked on use, and replaced. Presenting an already
  revoked token is treated as theft and revokes every session for that user.
- `POST /api/auth/logout` revokes the current refresh token and clears both cookies.

The dashboard's API client (`apps/admin-dashboard/src/lib/api.ts`) sends
`credentials: 'include'`, and on a `401` transparently calls `/auth/refresh` once and
retries. No token ever touches JavaScript or `localStorage`.

Set `COOKIE_SECURE=true` wherever the API is served over HTTPS.

## Environment variables

| File                        | Purpose                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| `.env`                      | Docker Compose only: Postgres user, password, db, host port               |
| `apps/backend/.env`         | API: `DATABASE_URL`, JWT secrets and TTLs, cookie flags, CORS, seed admin |
| `apps/admin-dashboard/.env` | Dashboard: dev proxy target, optional `VITE_API_BASE_URL`                 |

The backend validates its environment with zod on boot (`apps/backend/src/config/env.ts`)
and refuses to start with a clear error if anything is missing or malformed.

## Adding a new shared type

Edit `packages/shared/src`, then run `pnpm --filter @zuund/shared build` (or just `pnpm dev`,
which watches it). Both apps import from `@zuund/shared`.
