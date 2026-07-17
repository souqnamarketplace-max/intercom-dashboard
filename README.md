# IntercomOS — Property Dashboard

React + Vite + TypeScript, built against `intercom-backend`. Shares the same
visual identity as the resident app (ink/brass/bone palette, Fraunces +
Inter + IBM Plex Mono).

Verified in the sandbox before delivery: `npm install` succeeds, `tsc --noEmit`
reports zero errors, `npm run build` completes cleanly (36 modules, ~82KB
gzipped).

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_URL to your backend (Railway URL or
                        # http://localhost:3000 for local dev)
npm run dev
```

Log in with the `platform_admin` account created by the backend's
`prisma/seed.ts` script (`admin@example.com` by default — **change this
password immediately** if you haven't already).

## What's built

- **Staff login** (JWT, same auth as the backend's staff strategy)
- **Owners** (platform_admin only) — create building-owner customer accounts
- **Sites** — create/list, with a persistent site selector in the topbar that
  every other screen reads from
- **Units & Zones** — combined screen: create zones, create units, assign a
  unit to a zone inline, expand a unit to see/add/suspend/reactivate/move-out
  its linked residents
- **Delivery Authorizations** — per-carrier PIN with a configurable delivery
  window (open-all-day toggle, or specific days + time range), enable/disable/
  remove
- **Partner API Keys** — issue scoped credentials for third-party integrators
  (Yardi, CCTV/VMS, other access-control platforms). Scope checkboxes map
  directly to the backend's canonical scope list. The raw key is shown
  exactly once at creation, in a modal with a copy button, then never again.
- **Audit Trail** — cursor-paginated event log with a "Load more" button
  (matches the backend's keyset pagination, not offset-based)

## What's NOT built yet (next steps, not oversights)

- **Devices screen** — the backend currently has no `GET /devices` list
  endpoint (only `findOne(:id)`), so there's nothing to list against yet.
  Needs a small backend addition (`findAllForEntryPoint`) before this screen
  can exist.
- **Entry Points management UI** — the API exists (`/entry-points`), just
  hasn't been wired to a screen yet since device management naturally sits
  alongside it.
- **Resident directory search/privacy-mode preview**, **Virtual Keys UI**,
  **Card Fobs UI**, **Site Integrations (BMS/PMS adapter) UI** — all have
  working backend endpoints already, just no dashboard screen yet.
- **Owner billing rate editing** (flat fee / per-site / per-unit / per-resident
  rates) — owners can be created, but rates default to 0 and aren't editable
  from this UI yet.
- **Dashboard home/metrics screen** — there's no landing overview with
  counts (tenants, calls, door releases) like the ButterflyMX reference; the
  app currently lands on Sites instead.

## Notes

- The site selector persists across sessions via `localStorage` — the last
  site you viewed reopens automatically next login.
- Only `platform_admin` sees the "Owners" nav item; other roles never see
  a UI path to cross-tenant data (mirrors the backend's own role guards —
  this is a UX convenience, not the actual security boundary, which is
  enforced server-side).
- `Owners → New owner` only asks for a name; billing rate fields default to
  `0` server-side and can be edited via a future settings screen or directly
  via `PATCH /owners/:id`.
