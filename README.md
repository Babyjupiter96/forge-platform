# Forge Platform

A multi-tenant platform for embeddable **AI lead-qualification chat widgets**. A business drops one `<script>` tag on their site; visitors get a conversational assistant that diagnoses their problem, scores them as a lead, and offers a booking link only when they qualify. Staff review every lead in a dashboard.

Forge Digital ([weforgedigitalai.com](https://weforgedigitalai.com)) is tenant #1.

## How it works

```
 Client website                          Forge Platform
┌─────────────────┐   GET /api/widget-config    ┌────────────────────────────────────┐
│ <script         │ ──────────────────────────▶ │  apps/dashboard (Next.js 15)       │
│  data-forge-    │   POST /api/chat            │                                    │
│  embed-key=…>   │ ──────────────────────────▶ │  1. resolve site from embed key    │
│                 │                             │  2. check Origin against allowlist │
│  ┌───────────┐  │ ◀────── reply, score,       │  3. rate limit per visitor         │
│  │  widget   │  │         booking link        │  4. AI reply  ──▶ packages/ai      │
│  │(Shadow DOM)│ │                             │  5. score lead ─▶ deterministic    │
│  └───────────┘  │                             │  6. save via forOrg(orgId) ─▶ DB   │
└─────────────────┘                             │  7. QUALIFIED? ─▶ packages/booking │
                                                └────────────────┬───────────────────┘
                                                                 ▼
                                                   PostgreSQL (Prisma) + staff dashboard
```

## Key design decisions

**1. Tenant isolation lives in the data layer, not in review discipline.**
`forOrg(orgId)` returns a Prisma client extension that forces `orgId` into every read, update, and delete on tenant-owned models, and sets it on every create and upsert. Once a tenant is known, all data access goes through the scoped client; the only raw-client uses are the two lookups that must happen *before* a tenant is known (staff login by email, and resolving a site from its embed key). The repo includes an isolation check (`test:isolation`) that creates a throwaway second organization and asserts that neither tenant can see the other's data, so isolation is demonstrated, not assumed.

**2. The AI does not decide who qualifies.**
Qualification is a pure, deterministic function (`packages/ai/src/scoring`) with zero model calls: points for how much of the diagnostic profile is filled in, budget, timeline, decision-maker status, and service-area fit. A lead must clear a threshold before a booking link is offered. The model's conversational sense that someone "seems ready" is only a hint. That makes the gate auditable, unit-testable, and immune to prompt drift.

**3. Providers sit behind interfaces.**
`AIProvider` has OpenAI and Gemini implementations, selected by `AI_PROVIDER`, with per-provider model env vars so switching vendors can't hand one vendor's model name to the other. `BookingProvider` abstracts scheduling so Calendly is one implementation, not a hard dependency.

**4. The public endpoint is hardened for hostile input.**
`/api/chat` validates its body with Zod, resolves the tenant from an embed key, rejects any request whose `Origin` isn't on that site's allowlist (403), only sets CORS headers after that check passes, and rate-limits per `embedKey + visitorId` rather than IP (many visitors share an IP behind corporate NAT).

**5. The widget can't break, or be broken by, the host page.**
It's built with Vite in library mode into a single self-contained IIFE, and mounts inside a Shadow DOM root so the host's CSS can't leak in and the widget's can't leak out.

## Data model

`Organization` → `OrgUser` (roles) ← `User`; `Organization` → `Site` (embed key, allowed origins, theme) → `Conversation` → `Message`; `Conversation` → `Lead` (score, score breakdown, status, booking URL); `Organization` → `BookingIntegration`. See `packages/db/prisma/schema.prisma`.

## Repo layout

| Path | What it is |
|---|---|
| `apps/dashboard` | Next.js 15 app: staff login (NextAuth + bcrypt), leads table and lead detail, and the public widget API (`/api/widget-config`, `/api/chat`) |
| `apps/widget` | The embeddable React widget (Vite, Shadow DOM, single-file build) |
| `packages/db` | Prisma schema, the `forOrg()` tenant-scoping extension, seed script |
| `packages/ai` | `AIProvider` interface, OpenAI and Gemini providers, persona prompt builder, deterministic lead scorer and its tests |
| `packages/booking` | `BookingProvider` interface and the Calendly link provider |
| `packages/shared` | Zod schemas and types shared across packages |

## Getting started

Requires Node 20+, pnpm 9, and PostgreSQL (Docker via `docker-compose.yml`, or a local install; `scripts/db-up.sh` uses Docker if available and falls back to Homebrew Postgres).

```bash
pnpm install
cp .env.example .env         # then fill in values; set SEED_ADMIN_PASSWORD
# Prisma and Next.js each look for .env in their own directory, so link the
# root file instead of keeping three copies in sync:
ln -s ../../.env packages/db/.env
ln -s ../../.env apps/dashboard/.env
pnpm db:up                   # start Postgres
pnpm db:migrate              # apply the Prisma schema
pnpm db:seed                 # seed Forge Digital as tenant #1
pnpm --filter @forge/dashboard dev
pnpm --filter @forge/widget dev    # stand-in host page for the widget
```

## Verifying it works

```bash
pnpm --filter @forge/ai test                # scorer unit tests
pnpm --filter @forge/db test:isolation      # proves cross-tenant isolation
pnpm chat-cli --embedKey=<key>              # run the full diagnostic conversation in the terminal
pnpm db:studio                              # inspect the database
```

## Known limitations

- **The rate limiter is in-memory**, so it's per-process. Fine for one server; it needs a shared store like Redis before running multiple instances.
- **Test coverage is narrow.** There are 5 scorer unit tests and the tenant-isolation script; there are no API-level or end-to-end tests yet.
- **Scoring weights are initial values.** They're constants meant to be tuned against real conversations.
- **Booking is link-based.** The Calendly link provider works; the Calendly API provider is a stub that throws "not yet configured".
- The staff dashboard is intentionally minimal (leads list and detail).

## Tech

TypeScript · Next.js 15 · React 19 · Prisma 5 · PostgreSQL · NextAuth (v5 beta) · Zod · Vite · Vitest · Turborepo · pnpm workspaces · OpenAI / Gemini SDKs
