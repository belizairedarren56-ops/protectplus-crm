-- Phase 3C: extend import_client_entities() with a p_leads parameter so
-- leads import atomically alongside the other six entities.
--
-- Postgres function identity includes the parameter list — `create or
-- replace function` with a DIFFERENT argument count creates a new
-- overload, it does not replace the existing 7-argument function. The old
-- signature must be dropped explicitly first, or it would remain silently
-- callable (with its own now-orphaned grants) alongside the new one.
drop function if exists public.import_client_entities(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

create or replace function public.import_client_entities(
  p_agency_id uuid,
  p_policies jsonb default '[]'::jsonb,
  p_quotes jsonb default '[]'::jsonb,
  p_tasks jsonb default '[]'::jsonb,
  p_documents jsonb default '[]'::jsonb,
  p_client_notes jsonb default '[]'::jsonb,
  p_family_members jsonb default '[]'::jsonb,
  p_leads jsonb default '[]'::jsonb
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
  leads_count integer;
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

  insert into public.leads (
    agency_id, legacy_id, client_id, producer_id, client_name,
    insurance_type, stage, priority, last_contact, phone, email
  )
  select
    p_agency_id, r->>'legacyId', nullif(r->>'clientId', '')::uuid, (r->>'producerId')::uuid,
    r->>'clientName', (r->>'insuranceType')::public.insurance_type,
    coalesce((r->>'stage')::public.lead_stage, 'New'),
    coalesce((r->>'priority')::public.priority_level, 'Medium'),
    nullif(r->>'lastContact', '')::timestamptz, nullif(r->>'phone', ''), nullif(r->>'email', '')
  from jsonb_array_elements(p_leads) as r
  on conflict (agency_id, legacy_id) do nothing;
  get diagnostics leads_count = row_count;

  return jsonb_build_object(
    'policies', policies_count,
    'quotes', quotes_count,
    'tasks', tasks_count,
    'documents', documents_count,
    'clientNotes', notes_count,
    'familyMembers', family_count,
    'leads', leads_count
  );
end;
$$;

revoke all on function public.import_client_entities(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.import_client_entities(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
