# ProtectPlus CRM

An internal CRM for a small insurance agency: clients, leads, quotes, policies,
tasks, a document center, reports, and settings. Built with Next.js (App
Router) and TypeScript.

**Current data layer: clients, quotes, policies, tasks, documents, client
notes, family members, and leads are all backed by Supabase in `supabase`
mode (real auth, real Row Level Security); only notifications is still
`localStorage`, single browser.** Which mode is active is an explicit choice
— `NEXT_PUBLIC_DATA_BACKEND=demo|supabase` (see `.env.example`) — not
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
hooks/                One hook per entity (useClients, useQuotes, ...).
                       Supabase-backed entities: real repository + TanStack
                       Query. notifications: thin wrapper around
                       useLocalStorageList
lib/
  storage.ts           localStorage get/set helpers + key registry
  demoData.ts           Pure sample-data generators (no side effects)
  constants.ts, format.ts, csv.ts   Shared constants/formatters/CSV helpers
types/                 Shared entity types (Client, Lead, Quote, Policy, ...)
e2e/                   Playwright specs
**/__tests__/          Vitest specs, colocated with what they test
```

**Data flow — Supabase-backed entities (`Client`, `Quote`, `Policy`, `Task`,
`Document`, family members, client notes, `Lead` — both modes go through one
hook each).** `hooks/useClients()` and its seven siblings always call the
same TanStack Query hooks regardless of backend; only the *repository* each
one queries through is selected by a plain function
(`lib/repositories/<entity>Repository.ts`'s factory in `supabase` mode,
`lib/repositories/demo<Entity>Repository.ts` — hook-free wrappers around
`localStorage` — in `demo` mode). Both backends share one query cache per
entity, keyed by the current access scope (`hooks/useAccessScope.ts`), so
every consumer reads from the same source of truth instead of an independent
local copy. Repository methods return a typed `Result<T, Error>` rather than
throwing; `lib/result.ts`'s `unwrap()` is the one place that gets translated
into the throw/reject TanStack Query actually needs. Every list-shaped
entity (quotes/policies/tasks/documents/family members/leads) fetches its
whole RLS-scoped list once per scope and lets consumers filter client-side
(e.g. the client detail page's tabs, or leads' Kanban stage columns);
`useClientNotes(clientId)` is the one exception, keyed per-client since it's
only ever read one client at a time. `client_notes` writes go through a
dedicated `upsert_client_profile_note()` RPC rather than a plain
`.upsert()`, because Postgres can't target a partial unique index (the
mechanism that allows exactly one "profile" note per client while leaving
room for a future many-per-client note timeline) through PostgREST's
generic upsert. `family_members` has no owner column of its own —
visibility follows the parent client's assigned producer — and no `is_demo`
tag, since it cascade-deletes with its parent client instead. `useLeads()`'s
`updateLead` mutation is optimistic (the Kanban drag needs to feel instant),
scoped per-lead and guarded by a per-lead sequence number so an older,
overlapping mutation's failure can never clobber a newer mutation's
optimistic or already-settled state — every other entity's mutations are
plain `onSuccess`-based cache writes, since nothing else has a
latency-sensitive interaction.

**Data flow — `notifications`.** Still `localStorage`-backed, a thin wrapper
around `useLocalStorageList` in `hooks/useNotifications.ts`. In `demo` mode
the storage key is the same static name it's always been; in `supabase` mode
it's scoped by the full signed-in identity (`lib/scopedStorage.ts`) so two
different people on the same shared browser never read or write each
other's still-local data, even though every other entity is already
protected by real Supabase RLS. A versioned, crash-recoverable, multi-step
migration (`lib/localDataMigrations.ts`) converts a browser's pre-existing
data forward through each schema version in order (currently v1 → v2 → v3);
every step sources from the *previous* step's own versioned output — never
re-deriving from the original legacy keys once a later version is already
active — so a step added by a later phase (e.g. Phase 3C's v2 → v3, which
carried `leads` forward) never discards data written under an
already-active version. The original legacy keys, and every intermediate
version's keys, are never mutated once written, only read forward into the
next version.

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

Phase 1 (UI, `localStorage`), Phase 2 (Supabase schema/RLS/auth
foundation), Phase 3A (`clients` onto Supabase), Phase 3B (`policies`,
`quotes`, `tasks`, `documents`, `client_notes`, and `family_members` onto
Supabase), and **Phase 3C (this phase — `leads` and the Kanban pipeline UI
onto Supabase)** are complete. Every entity that has real auth-backed
ownership now has real Row Level Security enforcing it: producers only see
their own assigned clients/quotes/policies/tasks/leads (and, via the parent
client, their own family members and notes), admins see the whole agency.
Only `notifications` (Phase 3D) remains `localStorage`, followed by agency
settings (Phase 3E) — see the Phase 3 planning doc. Known, deliberate
limitations of the current phase:

- `NEXT_PUBLIC_DATA_BACKEND=demo` (the default outside production) behaves
  exactly like before — no Supabase involved at all for anyone who hasn't
  explicitly opted into `supabase` mode.
- `notifications` remains `localStorage`, scoped per signed-in identity in
  `supabase` mode (see Architecture above) but not yet backed by a real
  database or shared between users.
- No client picker or edit-lead UI in `AddLeadModal` — leads are created
  unlinked-to-a-client by default (matching `TaskModal`'s precedent) and
  stage changes only happen via the Kanban drag; a full lead-edit flow is a
  future phase.
- No permanent-delete UI for clients (or any other entity) — archive/restore
  only for clients, hard delete for quotes/policies/tasks/documents (admin-
  only for quotes/policies/documents, owner-or-admin for tasks, matching
  each entity's RLS policy) with no audit trail yet. A real audited
  permanent-delete path is a future phase.
- Documents are metadata-only — no real file upload/storage yet;
  `storage_path` stays reserved, unused.
- `Driver Licenses` and `Medical Documents` document folders stay disabled
  by default (`NEXT_PUBLIC_ENABLE_SENSITIVE_DOCUMENT_FOLDERS`), pending
  agency counsel/compliance sign-off on storage and retention design.
- No add/edit/remove UI for family members yet — still read-only display,
  only its data source changed this phase.
- `npm audit` currently reports high-severity findings inside `next`'s and
  `eslint`'s own dependency trees (`postcss`, `sharp`, `minimatch`). The
  suggested `npm audit fix --force` would downgrade `next` to `9.3.3` — do
  not run it. These need upstream patches, tracked via Dependabot, not a
  forced downgrade.
