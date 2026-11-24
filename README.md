# NTPCS — NeuraTrace GMP Print Control System

Phase 1 MVP: a standalone GMP controlled-printing and physical document
control system, built to work at a paper-first pharmaceutical site with no
DMS/QMS, and to integrate with one later (MasterControl, Veeva, AmpleLogic,
Caliber, SharePoint) without re-architecture.

## Stack
Next.js 14 (App Router, TS) · Hono API mounted at `/api/*` · PostgreSQL 16 +
Drizzle ORM · Redis/BullMQ (provisioned, not yet wired to a worker in this
MVP) · pdf-lib + qrcode for server-side controlled-copy PDFs · local-disk
object storage behind an `ObjectStorage` interface swappable for S3.

## Local setup
```
pnpm install
# Postgres + Redis must be running; see .env for connection strings
pnpm db:generate   # already run — migrations in src/db/migrations
pnpm db:migrate
pnpm db:seed       # Demo Pharma Laboratories Pvt Ltd, 22 documents, full
                   # acceptance-criteria scenario (5 copies → recall →
                   # 3 destroyed, 2 outstanding)
pnpm dev           # http://localhost:3000
```
Demo logins: any email printed by `db:seed`, password `Password123!`.

## What's implemented (Phase 1 + most of Phase 2 of the spec's own roadmap)
- Module A — Document Master Registry (works with zero files, scanned
  copies, or a real source PDF; revision history; paper-approval references
  explicitly distinct from e-signatures).
- Module B — Controlled Print Management (approval workflow, unique
  `DOC-REVxx-COPY-nnnn` IDs, cryptographically random QR tokens, server-side
  stamped PDFs with footer + QR + red UNCONTROLLED/SUPERSEDED overlay, print
  outcome logging).
- Module C — Physical Distribution & Inventory (full copy lifecycle state
  machine, issue/acknowledge/lost/damaged, inventory summary).
- Module D — QR Verification (public, unauthenticated scan endpoint;
  GREEN/AMBER/RED/GREY; offline-cache fallback with explicit last-sync
  notice; scanning never unlocks the source document).
- Module E — Revision Control & Recall (new revision → auto-recall of every
  active copy of the superseded revision; acknowledge → retrieve → witnessed
  destruction; exceptions; a recall **cannot** be closed while items are
  outstanding — verified by test, returns HTTP 409 with the list).
- Module F — Audit & Reporting (append-only `audit_events` on every
  transaction; CSV export for 7 of the 14 named registers; the rest are the
  same query pattern, not yet wired to a route).
- Paper-to-Digital onboarding wizard + Excel bulk document import.
- RBAC enforced in API middleware (`src/server/authz.ts`), not just the UI —
  verified by test (403s for the wrong role, 401 with no session).

## Deliberately deferred (flagged, not silently skipped)
- Redis/BullMQ queue is provisioned but no worker consumes it yet (would
  carry notification fan-out and QMS/DMS sync jobs).
- QMS/DMS adapters (`DocumentProvider` interface) are not built — manual
  import/export only, per spec §7's standalone-first requirement.
- PDF export for reports (CSV only); Excel export for reports.
- Full admin UI for site/department/role configuration (read-only views
  only — seeded via `db:seed`).
- No automated test suite yet (`pnpm test` is wired to vitest but has no
  specs) — this build was verified via live API smoke tests, documented in
  the session, rather than checked-in tests.
