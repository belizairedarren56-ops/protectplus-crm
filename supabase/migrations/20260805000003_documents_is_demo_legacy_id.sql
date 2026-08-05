-- Phase 3B: documents — is_demo (+ insert/update protection + clear RPC)
-- and legacy_id, exactly Phase 3A's clients pattern applied to this table.

alter table public.documents add column is_demo boolean not null default false;
alter table public.documents add column legacy_id text;

alter table public.documents
  add constraint documents_agency_legacy_id_unique unique (agency_id, legacy_id);

-- Extends the existing ownership check (unchanged) with the same is_demo
-- gate clients_insert already has: only an admin may insert a demo row.
alter policy documents_insert on public.documents
  with check (
    agency_id = public.current_agency_id()
    and (is_demo = false or public.is_admin())
    and (
      client_id is null
      or exists (
        select 1 from public.clients c
        where c.id = documents.client_id and public.owns_or_admin(c.assigned_producer_id)
      )
    )
  );

-- prevent_non_admin_is_demo_change() already exists (20260804000001) and is
-- fully generic — reused here exactly as it already is on clients, reading
-- OLD.is_demo/NEW.is_demo via the trigger's RECORD variables.
create trigger prevent_non_admin_is_demo_change before update on public.documents
  for each row execute function prevent_non_admin_is_demo_change();

-- Hardening checklist (independently re-verified, not assumed to carry over
-- from clear_agency_demo_clients() by similarity — see the Phase 3B plan):
-- (1) agency identity from current_agency_id(), no parameter exists to
--     supply a different one; (2) admin-only, checked before any write;
-- (3) every identifier fully schema-qualified; (4) search_path = '';
-- (5) EXECUTE revoked from PUBLIC, granted only to authenticated.
create or replace function public.clear_agency_demo_documents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can clear demo documents';
  end if;

  delete from public.documents
  where agency_id = public.current_agency_id()
    and is_demo = true;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.clear_agency_demo_documents() from public;
grant execute on function public.clear_agency_demo_documents() to authenticated;
