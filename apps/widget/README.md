# @forge/widget

Phase 4 of the plan (`/Users/babyjupiter/.claude/plans/reflective-waddling-crown.md`).

React + TypeScript, built with Vite in library mode (`pnpm --filter @forge/widget build`
emits a single `dist/forge-widget.js` IIFE — no module loader or separate CSS file needed
on the host page). Mounted into a Shadow DOM root so it can't leak into or be broken by the
host page's styles.

Consumes:
- `GET /api/widget-config?embedKey=...` for theming/copy
- `POST /api/chat` for the conversation, including the score → QUALIFIED → booking-link pivot

**Embed snippet** (what a client site drops in):
```html
<script src="https://.../forge-widget.js" data-forge-embed-key="..." data-forge-base-url="https://..."></script>
```

**Local dev**: `pnpm --filter @forge/widget dev` serves `index.html`, a stand-in host page
pointed at the seeded Forge Digital site + local dashboard API on :3001.
