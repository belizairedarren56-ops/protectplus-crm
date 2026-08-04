-- Phase 3A: adds a way to tag and later clear demo client rows in Supabase
-- mode, mirroring the existing `isDemo` convention already used throughout
-- the localStorage app (lib/demoData.ts). Purely additive — safe on top of
-- existing data, default false so every pre-existing row is unaffected.

alter table public.clients add column is_demo boolean not null default false;

-- A producer who could *create* demo clients but never clear them (the
-- clear_agency_demo_clients() RPC in the next migration is admin-only,
-- matching the existing clients_delete policy's admin-only shape) would
-- leave orphaned demo data only an admin could clean up. Closed at the RLS
-- layer, not just the UI: only an admin may insert a row with
-- is_demo = true. Non-admins can still insert ordinary (non-demo) clients
-- exactly as before — this only narrows the is_demo = true case.
alter policy clients_insert on public.clients
  with check (agency_id = public.current_agency_id() and (is_demo = false or public.is_admin()));
