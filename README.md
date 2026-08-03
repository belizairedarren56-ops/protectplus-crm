# ProtectPlus CRM

An internal CRM for a small insurance agency: clients, leads, quotes, policies,
tasks, a document center, reports, and settings. Built with Next.js (App
Router) and TypeScript.

**Current data layer: `clients` is backed by Supabase in `supabase` mode
(real auth, real Row Level Security); every other entity (leads, quotes,
policies, tasks, documents, notes, notifications) is still `localStorage`,
single browser.** Which mode is active is an explicit choice —
`NEXT_PUBLIC_DATA_BACKEND=demo|supabase` (see `.env.example`) — not
auto-detected from whether Supabase is configured. Do not enter real client,
policy, or financial data outside a properly access-controlled, hosted
deployment. See [Architecture](#architecture) and [Roadmap](#roadmap) below
for what that means in practice and what's planned to change it.

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

**Data flow — `clients` (Supabase-backed, both modes go through one hook).**
`hooks/useClients()` always calls the same TanStack Query hooks regardless of
backend; only the *repository* it queries through is selected by a plain
function (`lib/repositories/clientsRepository.ts`'s factory in `supabase`
mode, `lib/repositories/demoClientsRepository.ts` — a hook-free wrapper
around `localStorage` — in `demo` mode). Both backends share one query
cache, keyed by the current access scope (`hooks/useAccessScope.ts`), so
every consumer reads from the same source of truth instead of an independent
local copy. Repository methods return a typed `Result<T, Error>` rather than
throwing; `lib/result.ts`'s `unwrap()` is the one place that gets translated
into the throw/reject TanStack Query actually needs.

**Data flow — everything else (`Lead`, `Quote`, `Policy`, `Task`, `Document`,
`Notification`, `client_notes`).** Still `localStorage`-backed, one hook per
entity in `hooks/`, all thin wrappers around `useLocalStorageList`. In
`demo` mode the storage key is the same static name it's always been; in
`supabase` mode it's scoped by the full signed-in identity
(`lib/scopedStorage.ts`) so two different people on the same shared browser
never read or write each other's still-local data, even though `clients`
itself is already protected by real Supabase RLS. A one-time, versioned,
crash-recoverable migration (`lib/localDataMigrations.ts`) converts a
browser's pre-existing numeric-id data to the current string-id shape the
first time it loads; the original data is never mutated, only read.

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

Phase 1 (UI, `localStorage`) and Phase 2 (Supabase schema/RLS/auth
foundation) are complete. **Phase 3A (this phase) migrates `clients` off
`localStorage` onto Supabase** — real auth, real Row Level Security,
producers only seeing their own assigned clients, admins seeing the whole
agency. Every other entity is still `localStorage`, staged for its own
future phase (`policies`/`quotes`/`tasks`/`documents`/`client_notes`/
`family_members`, then `leads`, then `notifications`, then agency settings —
see the Phase 3 planning doc). Known, deliberate limitations of the current
phase:

- `NEXT_PUBLIC_DATA_BACKEND=demo` (the default outside production) behaves
  exactly like before — no Supabase involved at all for anyone who hasn't
  explicitly opted into `supabase` mode.
- Only `clients` is Supabase-backed; `leads`/`quotes`/`policies`/`tasks`/
  `documents`/`notifications`/`client_notes` remain `localStorage`, now
  scoped per signed-in identity in `supabase` mode (see Architecture above)
  but not yet backed by a real database or shared between users.
- No permanent-delete UI for clients — archive/restore only, same as before.
  A real permanent-delete path (admin-only, audited) is a future phase.
- Producer/assignee fields on the still-local entities (policies, quotes,
  tasks) remain free-text strings, not real user references — only
  `clients.assignedProducerId` is a real `profiles` reference so far.
- `npm audit` currently reports high-severity findings inside `next`'s and
  `eslint`'s own dependency trees (`postcss`, `sharp`, `minimatch`). The
  suggested `npm audit fix --force` would downgrade `next` to `9.3.3` — do
  not run it. These need upstream patches, tracked via Dependabot, not a
  forced downgrade.
