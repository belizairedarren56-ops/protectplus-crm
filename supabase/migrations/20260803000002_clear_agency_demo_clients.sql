-- Phase 3A: a narrowly-scoped RPC for clearing demo client rows, replacing
-- what would otherwise be a generic client-supplied
-- `DELETE ... WHERE is_demo = true` — RLS alone only gates *who* can delete
-- (admins, via the existing clients_delete policy), not *which* rows a
-- permitted admin can delete; this function hard-codes the is_demo = true
-- filter server-side so a client-side filter bug can never widen "clear
-- demo data" into "delete real clients."
--
-- Same SECURITY DEFINER conventions as every other Phase 2 helper function
-- (supabase/migrations/20260801000003_rls.sql): empty search_path (forces
-- fully-qualified names — every reference below is schema-qualified
-- accordingly), owned by whichever role runs the migration (never a role
-- the app could impersonate — Phase 2 never adds an explicit
-- `ALTER FUNCTION ... OWNER TO`, relying entirely on REVOKE/GRANT below, so
-- this migration follows that same, verified pattern rather than inventing
-- a new one), EXECUTE revoked from PUBLIC and granted only to `authenticated`.

create or replace function public.clear_agency_demo_clients()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can clear demo clients';
  end if;

  delete from public.clients
  where agency_id = public.current_agency_id()
    and is_demo = true;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.clear_agency_demo_clients() from public;
grant execute on function public.clear_agency_demo_clients() to authenticated;
