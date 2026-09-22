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
                                                 │  8. first time QUALIFIED? ─▶ email │
                                                └────────────────┬───────────────────┘
                                                                 ▼
                                                   PostgreSQL (Prisma) + staff dashboard
```

The turn a conversation first crosses the qualification threshold, `apps/dashboard/lib/email.ts` emails the configured address (Gmail SMTP via an app password) with the lead's score, contact details, and a dashboard link — so staff don't have to poll `/leads` to notice a qualified lead. It fires once per conversation, gated on `existingLead.status !== "QUALIFIED"`, not on every message of an already-qualified thread. `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `LEAD_NOTIFY_EMAIL` in `.env.example`; if either Gmail credential is unset, sending is skipped with a console warning instead of failing the request.

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
pnpm test                                   # 145 unit tests across ai, db, and dashboard (no database needed)
pnpm typecheck
pnpm --filter @forge/db test:isolation      # integration check against a real database: proves cross-tenant isolation
pnpm chat-cli --embedKey=<key>              # run the full diagnostic conversation in the terminal
pnpm db:studio                              # inspect the database
```

What the unit tests pin down:

| Area | What's asserted |
|---|---|
| `forOrg()` tenant scoping (`packages/db`) | Every read/update/delete on each tenant-owned model is filtered by `orgId`; a caller-supplied foreign `orgId` is overridden; creates, `createMany`, and upserts set it; unscoped models pass through; an empty `orgId` throws. |
| Lead scoring (`packages/ai`) | The 59/60 qualification boundary, every budget and timeline weight, the "not asked" vs "don't know" budget distinction, decision-maker penalty, disqualification rules, score clamping, determinism, and no input mutation. |
| Origin allowlist (`resolveSite`) | Unknown and inactive keys are indistinguishable (404); lookalike, wrong-scheme, wrong-port, trailing-slash, and wrong-case origins are rejected (403). |
| Rate limiter and CORS | 20 requests per 60 s per key, exact window edge, independent keys; CORS echoes the specific origin and never a wildcard. |
| Qualification email (`/api/chat`, `lib/email.ts`) | Fires once, the turn a conversation first reaches QUALIFIED, not on later messages of an already-qualified thread; skipped without failing the request when no notify address is configured; subject/body content, HTML escaping. |

CI runs type-check and the test suite on every push.

## Known limitations

- **The rate limiter is in-memory**, so it's per-process. Fine for one server; it needs a shared store like Redis before running multiple instances.
- **No API-level or end-to-end tests yet.** The units around the `/api/chat` route are tested (tenant scoping, scoring, origin check, rate limit, CORS), and the tenant-isolation script exercises a real database, but the route handler itself and the widget are not covered.
- **`forOrg()` guards reads and creates, not `update` payloads.** An update that sets `data.orgId` would not be rewritten. Nothing in the app does this today, but the extension does not prevent it.
- **Scoring weights are initial values.** They're constants meant to be tuned against real conversations.
- **Booking is link-based.** The Calendly link provider works; the Calendly API provider is a stub that throws "not yet configured".
- The staff dashboard is intentionally minimal (leads list and detail).
- **Lead notification email is per-org via env vars, not a Site/Organization column.** Fine with one tenant (Forge Digital); a second tenant wanting its own notify address would need that moved into the schema.

## Tech

TypeScript · Next.js 15 · React 19 · Prisma 5 · PostgreSQL · NextAuth (v5 beta) · Zod · Vite · Vitest · Turborepo · pnpm workspaces · OpenAI / Gemini SDKs
