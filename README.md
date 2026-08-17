# Forge Platform

Multi-tenant AI growth-consultant widget platform. Forge Digital (weforgedigitalai.com) is
tenant #1. See `/Users/babyjupiter/.claude/plans/reflective-waddling-crown.md` for the full
Phase 0–2 plan this was built from.

## Local setup

This machine has no Docker, so Postgres runs via Homebrew (`postgresql@16`) instead of the
`docker-compose.yml` in this repo (kept for portability — `scripts/db-up.sh` prefers Docker if
it's available, falls back to Homebrew otherwise).

```bash
pnpm install
pnpm db:up        # starts Postgres (Docker or Homebrew, whichever is available)
pnpm db:migrate    # applies the Prisma schema
pnpm db:seed       # seeds Forge Digital as tenant #1 — set SEED_ADMIN_PASSWORD in .env first
pnpm --filter @forge/dashboard dev   # http://localhost:3000
```

`.env` (gitignored) holds all local secrets. `packages/db/.env` and `apps/dashboard/.env` are
symlinks to the root `.env` — Prisma and Next.js each only look for `.env` in their own
directory, so this keeps a single source of truth instead of three copies to keep in sync.

## Verifying without a browser

- `pnpm db:studio` — inspect the database directly.
- `pnpm --filter @forge/db test:isolation` — proves cross-tenant isolation (`forOrg()`) actually
  works, not just that it looks right in review.
- `pnpm --filter @forge/ai test` — deterministic lead-scorer unit tests.
- `pnpm chat-cli --embedKey=<key>` — terminal harness for the full diagnostic conversation
  (get `<key>` from the seed script's output, or `SELECT "embedKey" FROM "Site";`). Requires
  `OPENAI_API_KEY` in `.env`.

## Structure

- `apps/dashboard` — Next.js 15 app: staff auth + the public widget-facing API
  (`/api/widget-config`, `/api/chat`) + a minimal leads table.
- `apps/widget` — not built yet (Phase 4).
- `packages/db` — Prisma schema, the `forOrg()` tenant-scoping client extension, seed script.
- `packages/ai` — `AIProvider` interface, OpenAI implementation, Forge persona prompt builder,
  deterministic lead scorer.
- `packages/booking` — `BookingProvider` interface, Calendly link-only implementation
  (needs no credentials).
- `packages/shared` — Zod schemas and types shared between packages.
