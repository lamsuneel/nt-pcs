# Deploying NTPCS — platform-agnostic guide

This is a standard Next.js 14 app (the API is Hono, mounted inside Next's own
route handler — there is no separate backend process to run) plus a
PostgreSQL database. It will run on any host that runs Node 18+, pointed at
any Postgres 14+.

## 1. Get a Postgres database

Pick any one of these — the app only needs a `DATABASE_URL` connection string:

- **Neon** (https://neon.tech) — free tier, serverless, works well with Vercel.
- **Supabase** (https://supabase.com) — free tier, includes a SQL editor.
- **Railway** (https://railway.app) — one-click Postgres.
- **Your own server** — `docker compose up -d` (uses the included
  `docker-compose.yml`) or any existing Postgres 14+ instance.

Once you have one, load the schema + demo data into it. Two ways:

**Option A — plain SQL (no Node/npm needed at all):**
```bash
psql "<your DATABASE_URL>" < db-exports/full-with-seed-data.sql
```
This restores the full schema *and* the seeded "Demo Pharma Laboratories"
dataset (22 documents, the full recall acceptance scenario, demo users). Use
`db-exports/schema-only.sql` instead if you want an empty schema with no
demo data.

**Option B — via Drizzle (if you're going to develop further):**
```bash
pnpm install
pnpm db:migrate   # applies src/db/migrations/*.sql
pnpm db:seed       # populates demo data via src/db/seed.ts
```

## 2. Set environment variables

Copy `.env.example` to `.env` (or set these directly in your host's env-var
UI) and fill in:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | From step 1. |
| `JWT_SECRET` | Yes | Any long random string — `openssl rand -base64 48`. Signs session cookies. |
| `APP_BASE_URL` | Yes | The public URL you'll deploy to. Used to build the QR-verify links baked into generated PDFs — get this wrong and QR codes point at the wrong host. |
| `REDIS_URL` | No | Provisioned for a future notification queue; no route in this MVP actually uses it. Safe to leave unset. |

## 3. Deploy the app

Pick whichever you're most comfortable with — none of this is Vercel-specific:

### Vercel
```bash
npm i -g vercel
vercel link        # or import the GitHub repo in the Vercel dashboard
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add APP_BASE_URL production
vercel --prod
```

### Railway / Render
Both auto-detect Next.js from `package.json` (`build` → `next build`,
`start` → `next start`). Just set the env vars above in their dashboard and
point them at this repo/folder.

### Any VPS / Docker
```bash
pnpm install
pnpm build
pnpm start -p 3000   # or run behind nginx/caddy with a process manager (pm2, systemd)
```

### Self-contained Docker (DB included)
`docker-compose.yml` brings up Postgres (and an unused Redis) locally. It
does **not** build the app image itself — add an `app` service to it if you
want the whole stack (DB + app) in one `docker compose up`, or just run the
app with `pnpm start` alongside the composed Postgres.

## 4. Log in

Demo accounts (password `Password123!` for all of them) — see the full list
in `README.md`. Start with `qa.head@demo-pharma.local` for the fullest view
of the system.

## What you're deploying

See `README.md` for the full feature list and what's deliberately stubbed
(QMS/DMS adapters, PDF/Excel report export, notification worker, admin UI
for roles — CSV reports, core workflow, and RBAC are all live).
