-- Phase 3B: import_client_entities() — the one server-side function
-- scripts/migrate-client-entities-to-supabase.ts calls to write all six
-- entities (policies, quotes, tasks, documents, client_notes,
-- family_members) in a single real database transaction.
--
-- Why this exists at all: six separate PostgREST upsert calls are six
-- independent transactions — if the fourth failed, the first three would
-- already be committed, leaving exactly the partial-import state
-- "all-or-nothing" is supposed to rule out. A single plpgsql function body
-- IS one implicit transaction: any exception anywhere inside it rolls back
-- everything the function did, automatically, with no partial-commit
-- window. This is the only way to get true cross-entity atomicity through
-- Supabase's normal (non-raw-pg) surface.
--
-- Idempotency: each entity's own (agency_id, legacy_id) unique constraint
-- (already added in that entity's own Phase 3B migration) backs an
-- `on conflict ... do nothing` — already-imported rows are skipped, never
-- duplicated. client_notes has no legacy_id (see
-- 20260805000001_client_notes_profile_type.sql) — it upserts against the
-- same (agency_id, client_id) WHERE note_type = 'profile' partial unique
-- index upsert_client_profile_note() already uses, so re-running updates
-- the same row in place rather than duplicating it.
--
-- Defense in depth: every client_id below still flows through the
-- existing composite FK to clients(id, agency_id) — a hypothetical bug
-- that let a cross-agency uuid slip past the calling script's own
-- validation would still hit a foreign-key violation here, which (being
-- inside this one function's transaction) rolls back the entire import,
-- not just that row.
--
-- Why p_agency_id is a parameter, unlike every clear_agency_demo_*() RPC
-- (which all derive agency identity from current_agency_id(), never a
-- parameter): those are called by a signed-in admin's browser session,
-- where current_agency_id() correctly resolves through their JWT. This
-- function is called by a local Node script running as the service role,
-- which has no auth.uid()/session at all — there is no identity for
-- current_agency_id() to resolve, so the agency has to be an explicit,
-- human-supplied argument (the same --agency-id flag
-- migrate-clients-to-supabase.ts already requires). EXECUTE is granted to
-- service_role only, never authenticated — no browser-reachable path, admin
-- or not, can invoke this function through any client.

create or replace function public.import_client_entities(
  p_agency_id uuid,
  p_policies jsonb default '[]'::jsonb,
  p_quotes jsonb default '[]'::jsonb,
  p_tasks jsonb default '[]'::jsonb,
  p_documents jsonb default '[]'::jsonb,
  p_client_notes jsonb default '[]'::jsonb,
  p_family_members jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  policies_count integer;
  quotes_count integer;
  tasks_count integer;
  documents_count integer;
  notes_count integer;
  family_count integer;
begin
  insert into public.policies (
    agency_id, legacy_id, client_id, producer_id, client_name, carrier,
    policy_number, product, effective_date, expiration_date, status, premium
  )
  select
    p_agency_id, r->>'legacyId', (r->>'clientId')::uuid, (r->>'producerId')::uuid,
    r->>'clientName', r->>'carrier', r->>'policyNumber',
    (r->>'product')::public.insurance_type, (r->>'effectiveDate')::date,
    (r->>'expirationDate')::date, coalesce((r->>'status')::public.policy_status, 'Active'),
    (r->>'premium')::numeric
  from jsonb_array_elements(p_policies) as r
  on conflict (agency_id, legacy_id) do nothing;
  get diagnostics policies_count = row_count;

  insert into public.quotes (
    agency_id, legacy_id, client_id, producer_id, client_name, carrier,
    premium, coverage, insurance_type, status
  )
  select
    p_agency_id, r->>'legacyId', (r->>'clientId')::uuid, (r->>'producerId')::uuid,
    r->>'clientName', r->>'carrier', (r->>'premium')::numeric, nullif(r->>'coverage', ''),
    (r->>'insuranceType')::public.insurance_type, coalesce((r->>'status')::public.quote_status, 'Draft')
  from jsonb_array_elements(p_quotes) as r
  on conflict (agency_id, legacy_id) do nothing;
  get diagnostics quotes_count = row_count;

  insert into public.tasks (
    agency_id, legacy_id, client_id, assigned_to, title, description,
    priority, due_date, status
  )
  select
    p_agency_id, r->>'legacyId', nullif(r->>'clientId', '')::uuid, (r->>'assignedTo')::uuid,
    r->>'title', nullif(r->>'description', ''),
    coalesce((r->>'priority')::public.priority_level, 'Medium'),
    (r->>'dueDate')::date, coalesce((r->>'status')::public.task_status, 'Open')
  from jsonb_array_elements(p_tasks) as r
  on conflict (agency_id, legacy_id) do nothing;
  get diagnostics tasks_count = row_count;

  insert into public.documents (agency_id, legacy_id, client_id, folder, name, file_type)
  select
    p_agency_id, r->>'legacyId', nullif(r->>'clientId', '')::uuid,
    (r->>'folder')::public.document_folder, r->>'name', nullif(r->>'fileType', '')
  from jsonb_array_elements(p_documents) as r
  on conflict (agency_id, legacy_id) do nothing;
  get diagnostics documents_count = row_count;

  insert into public.client_notes (agency_id, client_id, note_type, body)
  select p_agency_id, (r->>'clientId')::uuid, 'profile', r->>'body'
  from jsonb_array_elements(p_client_notes) as r
  on conflict (agency_id, client_id) where note_type = 'profile'
  do update set body = excluded.body;
  get diagnostics notes_count = row_count;

  insert into public.family_members (agency_id, legacy_id, client_id, name, relationship, date_of_birth)
  select
    p_agency_id, r->>'legacyId', (r->>'clientId')::uuid, r->>'name', r->>'relationship',
    nullif(r->>'dateOfBirth', '')::date
  from jsonb_array_elements(p_family_members) as r
  on conflict (agency_id, legacy_id) do nothing;
  get diagnostics family_count = row_count;

  return jsonb_build_object(
    'policies', policies_count,
    'quotes', quotes_count,
    'tasks', tasks_count,
    'documents', documents_count,
    'clientNotes', notes_count,
    'familyMembers', family_count
  );
end;
$$;

revoke all on function public.import_client_entities(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.import_client_entities(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
