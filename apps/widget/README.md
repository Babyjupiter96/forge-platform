# @forge/widget

Scaffolded but not built out — this is Phase 4 of the plan
(`/Users/babyjupiter/.claude/plans/reflective-waddling-crown.md`).

It will consume:
- `GET /api/widget-config?embedKey=...` for theming (already returns full `themeTokens`)
- `POST /api/chat` for the conversation (request/response contract already stable, see
  `apps/dashboard/app/api/chat/route.ts`)

React + TypeScript, built with Vite in library mode, mounted into a Shadow DOM root so it
can't leak into or be broken by the host page's styles.
