# ProtectPlus CRM

An internal CRM for a small insurance agency: clients, leads, quotes, policies,
tasks, a document center, reports, and settings. Built with Next.js (App
Router) and TypeScript.

**Current data layer: `localStorage`, single browser, no authentication.**
There is no backend yet — every record lives in the browser that created it.
Do not enter real client, policy, or financial data. See
[Architecture](#architecture) and [Roadmap](#roadmap) below for what that
means in practice and what's planned to change it.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app starts with no
data — go to **Settings → Demo Data → Load Demo Data** to populate it with
~50 realistic sample clients and related policies, quotes, leads, tasks, and
documents. Demo records are tagged internally, so **Clear Demo Data** only
ever removes what that button generated; anything you create yourself is
never touched by it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — unit/component tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright — end-to-end tests against a real browser |

Playwright needs its browser binary once, locally: `npx playwright install
chromium`. CI installs it automatically (see `.github/workflows/ci.yml`).

## Architecture

```
app/                  Route pages (App Router), one folder per section
components/
  ui/                 Reusable primitives: Button, Modal, Card, Table, Badge...
  layout/             AppShell, Sidebar, Topbar, GlobalSearch, NotificationBell
  clients/ leads/ quotes/ policies/ tasks/   Feature-specific components
hooks/                One hook per entity (useClients, useQuotes, ...), all
                       thin wrappers around useLocalStorageList
lib/
  storage.ts           localStorage get/set helpers + key registry
  demoData.ts           Pure sample-data generators (no side effects)
  constants.ts, format.ts, csv.ts   Shared constants/formatters/CSV helpers
types/                 Shared entity types (Client, Lead, Quote, Policy, ...)
e2e/                   Playwright specs
**/__tests__/          Vitest specs, colocated with what they test
```

**Data flow.** Every entity (`Client`, `Lead`, `Quote`, `Policy`, `Task`,
`Document`, `Notification`) has its own hook in `hooks/` that loads from and
saves to a dedicated `localStorage` key (see `lib/storage.ts`'s
`STORAGE_KEYS`). Pages call these hooks directly and get back
`{ items, setItems, loaded }`-shaped state — there is no shared store or
context, so two components each calling the same hook hold independent state,
synced only through `localStorage`, not live between each other. In practice
this is safe because only one component "writes" to a given entity at a time
in the current UI (see `hooks/useDemoData.ts`'s comment for the one place this
mattered).

**Demo data vs. real data.** `lib/demoData.ts` exports pure generator
functions — they return data, they never touch storage. `hooks/useDemoData.ts`
is the only thing that writes demo data, and it does so through each entity's
real setter (never a raw `localStorage` write), which is what makes "Clear
Demo Data" safe: every demo record is tagged `isDemo: true`, so clearing
filters on that tag and never touches a record you created yourself.

**Client deletion is archive-only.** There is no permanent-delete path in the
app today — see [Roadmap](#roadmap). Archiving a client sets `archivedAt` and
hides it from the default Clients view; it never touches that client's
policies, quotes, tasks, notes, or documents. Restoring clears the flag.

## Testing

- **Unit/component** (Vitest + React Testing Library): entity logic, modal
  state handling, and page-level behavior like archive/restore and CSV
  import/export. Run with `npm test`.
- **End-to-end** (Playwright, real Chromium): the add-client flow, the lead
  Kanban drag interaction, and a no-console-errors smoke pass over every
  route. Run with `npm run test:e2e`. `playwright.config.ts` reuses an
  already-running `npm run dev` server locally, or builds and starts a
  production server in CI.

## Roadmap

This is Phase 1 of a larger plan to move off `localStorage` onto a real
database with authentication and role-based access (producers only seeing
their own assigned clients/leads/policies/quotes/tasks, admins seeing
everything). That plan — schema, row-level security, migration strategy, and
a phased cutover that keeps the current UI intact — lives outside this repo
in the project's planning docs; ask before assuming any Supabase/auth code
exists yet, because as of this Phase it doesn't. Known, deliberate
limitations of the current phase:

- No authentication or access control of any kind.
- No backups, audit log, or way to recover data if a browser's storage is
  cleared.
- Quotes and policies require picking a real client from a dropdown (so they
  always have a valid `clientId`), but producer/assignee fields elsewhere are
  still free-text strings, not real user references — that only makes sense
  once real accounts exist.
- `npm audit` currently reports high-severity findings inside `next`'s and
  `eslint`'s own dependency trees (`postcss`, `sharp`, `minimatch`). The
  suggested `npm audit fix --force` would downgrade `next` to `9.3.3` — do
  not run it. These need upstream patches, tracked via Dependabot, not a
  forced downgrade.
