-- Phase 3A correction: clients_insert already restricts WHO may INSERT a row
-- with is_demo = true (admin-only — see 20260803000001_add_client_is_demo.sql),
-- but nothing stopped a non-admin from UPDATE-ing an existing row's is_demo
-- afterward: a producer could flip their own real client to is_demo = true
-- (sidestepping the insert-time check entirely) or flip an existing demo
-- client to is_demo = false (hiding it from clear_agency_demo_clients()'s
-- admin-only sweep). RLS's WITH CHECK only sees the new row, so it can't
-- compare against the row's previous value — this needs a trigger, the same
-- pattern already used for assigned_producer_id reassignment
-- (prevent_client_producer_reassignment, 20260801000003_rls.sql). Ordinary
-- field updates (status, contact info, ...) by a non-admin producer are
-- unaffected — only a change to is_demo itself is blocked.

create or replace function prevent_non_admin_is_demo_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Same service-role guard as every other ownership-guard trigger: a NULL
  -- auth.uid() means no authenticated end-user session (migrations, the
  -- importer script, backend jobs), already more trusted than anything RLS
  -- mediates — see 20260801000003_rls.sql's ownership-guard-trigger comment
  -- for the full reasoning.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() and old.is_demo is distinct from new.is_demo then
    raise exception 'Only an admin can change a client''s demo classification';
  end if;
  return new;
end;
$$;

revoke all on function prevent_non_admin_is_demo_change() from public;

create trigger prevent_non_admin_is_demo_change before update on public.clients
  for each row execute function prevent_non_admin_is_demo_change();
