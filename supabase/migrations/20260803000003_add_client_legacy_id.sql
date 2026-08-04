-- Phase 3A: gives scripts/migrate-clients-to-supabase.ts a real, database-
-- enforced idempotency guarantee. Nullable and populated only by that
-- importer — always null for any client created normally through the app.
-- Re-running the importer against the same source file is then a matter of
-- `upsert(..., { onConflict: "agency_id,legacy_id", ignoreDuplicates: true })`:
-- already-imported rows are skipped, nothing is ever duplicated, with no
-- separate ledger file to keep in sync or lose.

alter table public.clients add column legacy_id text;

alter table public.clients
  add constraint clients_agency_legacy_id_unique unique (agency_id, legacy_id);
