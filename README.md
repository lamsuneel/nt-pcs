# PrintAssure — Product Preview (demo)

A lean, single-page clickable demo of **PrintAssure** (GMP controlled printing &
physical document control), built for the MasterControl partnership pitch.

See `claude/PrintAssure-MasterControl-Partnership-Research.md` for the
competitive research and roadmap this demo supports.

## What's real vs. mocked

- **Basic tier** (Document Register, Controlled Copies) is backed by a real,
  lean Postgres database — `documents` and `controlled_copies` tables — via
  `src/lib/db.ts` and `src/app/route.ts`. If the DB is unreachable, the page
  falls back to static demo data so a live pitch never breaks.
- **Pro and Max tier** screens (Audit Ledger, Inventory Map, Print Server,
  Follow-Me Print, AI Anomaly Watch, etc.) are entirely client-side simulated
  interactions — toasts, fake progress bars, canned numbers — matching the
  honest buildability assessment in the research doc. Nothing there hits a
  database.

## Running locally

```bash
pnpm install
cp .env.example .env   # set DATABASE_URL
pnpm run dev
```

Open http://localhost:3000.

## Database schema

Three tables, created directly (no ORM/migrations layer — intentionally lean):

- `documents(id, document_number, title, doc_type, department, status, created_at)`
- `print_requests(id, document_id, document_label, num_copies, destination, status, created_at)`
- `controlled_copies(id, copy_identifier, document_id, location, status, created_at)`

## Deploying

Set `DATABASE_URL` in your hosting provider's environment variables (e.g.
Vercel → Project Settings → Environment Variables) and deploy.
