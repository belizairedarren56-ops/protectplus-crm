-- Phase 3C: leads — is_demo (+ insert/update protection + clear RPC) and
-- legacy_id, exactly the tasks/quotes/policies pattern applied to this table.

alter table public.leads add column is_demo boolean not null default false;
alter table public.leads add column legacy_id text;

alter table public.leads
  add constraint leads_agency_legacy_id_unique unique (agency_id, legacy_id);

-- Extends the existing agency check (unchanged) with the same is_demo gate
-- clients_insert/tasks_insert/etc. already have: only an admin may insert a
-- demo row. producer_id's own default-to-self/admin-reassignment behavior
-- is already handled by force_owner_leads()/guard_reassign_leads() and is
-- untouched by this migration.
alter policy leads_insert on public.leads
  with check (agency_id = public.current_agency_id() and (is_demo = false or public.is_admin()));

create trigger prevent_non_admin_is_demo_change before update on public.leads
  for each row execute function prevent_non_admin_is_demo_change();

-- Hardening checklist (independently re-verified — see the Phase 3C plan):
-- (1) agency identity from current_agency_id(), no parameter exists to
--     supply a different one; (2) admin-only, checked before any write;
-- (3) every identifier fully schema-qualified; (4) search_path = '';
-- (5) EXECUTE revoked from PUBLIC, granted only to authenticated.
create or replace function public.clear_agency_demo_leads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can clear demo leads';
  end if;

  delete from public.leads
  where agency_id = public.current_agency_id()
    and is_demo = true;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.clear_agency_demo_leads() from public;
grant execute on function public.clear_agency_demo_leads() to authenticated;
