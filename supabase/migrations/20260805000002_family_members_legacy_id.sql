-- Phase 3B: family_members gets a legacy_id, same shape as clients' from
-- Phase 3A — the natural key the importer uses to stay idempotent on rerun.
-- family_members never had a real prior identity of its own (it was always
-- generated inline inside a demo client draft), so the importer synthesizes
-- one (`${legacyClientId}-${index within that client's family array}`)
-- purely so re-running the importer against the same export file is
-- idempotent, matching every other imported entity.

alter table public.family_members add column legacy_id text;

alter table public.family_members
  add constraint family_members_agency_legacy_id_unique unique (agency_id, legacy_id);
