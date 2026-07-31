-- ProtectPlus CRM — Phase 2 foundation: RLS
--
-- Agency boundary is the outer, non-negotiable check on every table.
-- Producers are additionally scoped to rows they own; admins see the full
-- agency. Helper functions are SECURITY DEFINER with an empty search_path
-- (current Postgres/Supabase hardening guidance — forces fully-qualified
-- names, closing the search_path-hijack footgun), owned by the migration
-- role (never a superuser the app could impersonate), with EXECUTE revoked
-- from PUBLIC and granted only to `authenticated`.

-- ── Helper functions ─────────────────────────────────────────────────────

create or replace function auth_profile()
returns profiles
language sql
security definer
set search_path = ''
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = 'admin',
    false
  );
$$;

create or replace function current_agency_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select agency_id from public.profiles where id = auth.uid();
$$;

create or replace function owns_or_admin(owner uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_admin() or owner = auth.uid();
$$;

revoke all on function auth_profile() from public;
revoke all on function is_admin() from public;
revoke all on function current_agency_id() from public;
revoke all on function owns_or_admin(uuid) from public;
grant execute on function auth_profile() to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function current_agency_id() to authenticated;
grant execute on function owns_or_admin(uuid) to authenticated;

-- ── Base table privileges ────────────────────────────────────────────────
-- GRANT decides whether a role can attempt an operation at all; RLS then
-- filters which rows — and these are independent: BYPASSRLS (which
-- `service_role` has) only skips the *policy* check, it does not imply the
-- base table GRANT. Newer Supabase projects default `auto_expose_new_tables`
-- to false, so nothing is reachable via any Data API role without an
-- explicit grant here, `service_role` included. This app is
-- internal/authenticated-only — the `anon` role gets nothing on any
-- business table.

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  agencies, profiles, clients, family_members, leads, quotes, policies,
  tasks, documents, client_notes, notifications, activity_log
  to authenticated, service_role;

-- ── Enable RLS everywhere ────────────────────────────────────────────────

alter table agencies enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table family_members enable row level security;
alter table leads enable row level security;
alter table quotes enable row level security;
alter table policies enable row level security;
alter table tasks enable row level security;
alter table documents enable row level security;
alter table client_notes enable row level security;
alter table notifications enable row level security;
alter table activity_log enable row level security;

-- ── Ownership-guard triggers ──────────────────────────────────────────────
-- RLS policies below gate INSERT/UPDATE on "agency matches", but they can't
-- by themselves force an ownership column to a specific value or compare it
-- against its previous value (WITH CHECK only sees the new row). These
-- triggers do that part: non-admins can only ever create rows owned by
-- themselves, and only an admin can reassign an existing row's owner.

create or replace function default_and_guard_client_producer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_producer_id is null then
    new.assigned_producer_id = auth.uid();
  elsif not public.is_admin() and new.assigned_producer_id <> auth.uid() then
    raise exception 'Only an admin can assign a client to another producer';
  end if;
  return new;
end;
$$;

create or replace function prevent_client_producer_reassignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and old.assigned_producer_id is distinct from new.assigned_producer_id then
    raise exception 'Only an admin can reassign a client''s producer';
  end if;
  return new;
end;
$$;

revoke all on function default_and_guard_client_producer() from public;
revoke all on function prevent_client_producer_reassignment() from public;

create trigger default_and_guard_client_producer before insert on clients
  for each row execute function default_and_guard_client_producer();
create trigger prevent_client_producer_reassignment before update on clients
  for each row execute function prevent_client_producer_reassignment();

-- Same pattern for leads/quotes/policies.producer_id (NOT NULL — forced to
-- auth.uid() outright for non-admins rather than defaulted-when-null).

create or replace function force_owner_leads()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then new.producer_id = auth.uid(); end if;
  return new;
end;
$$;
create or replace function guard_reassign_leads()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() and old.producer_id is distinct from new.producer_id then
    raise exception 'Only an admin can reassign a lead''s producer';
  end if;
  return new;
end;
$$;

create or replace function force_owner_quotes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then new.producer_id = auth.uid(); end if;
  return new;
end;
$$;
create or replace function guard_reassign_quotes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() and old.producer_id is distinct from new.producer_id then
    raise exception 'Only an admin can reassign a quote''s producer';
  end if;
  return new;
end;
$$;

create or replace function force_owner_policies()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then new.producer_id = auth.uid(); end if;
  return new;
end;
$$;
create or replace function guard_reassign_policies()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() and old.producer_id is distinct from new.producer_id then
    raise exception 'Only an admin can reassign a policy''s producer';
  end if;
  return new;
end;
$$;

create or replace function force_owner_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then new.assigned_to = auth.uid(); end if;
  return new;
end;
$$;
create or replace function guard_reassign_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() and old.assigned_to is distinct from new.assigned_to then
    raise exception 'Only an admin can reassign a task';
  end if;
  return new;
end;
$$;

revoke all on function force_owner_leads() from public;
revoke all on function guard_reassign_leads() from public;
revoke all on function force_owner_quotes() from public;
revoke all on function guard_reassign_quotes() from public;
revoke all on function force_owner_policies() from public;
revoke all on function guard_reassign_policies() from public;
revoke all on function force_owner_tasks() from public;
revoke all on function guard_reassign_tasks() from public;

create trigger force_owner before insert on leads
  for each row execute function force_owner_leads();
create trigger guard_reassign before update on leads
  for each row execute function guard_reassign_leads();

create trigger force_owner before insert on quotes
  for each row execute function force_owner_quotes();
create trigger guard_reassign before update on quotes
  for each row execute function guard_reassign_quotes();

create trigger force_owner before insert on policies
  for each row execute function force_owner_policies();
create trigger guard_reassign before update on policies
  for each row execute function guard_reassign_policies();

create trigger force_owner before insert on tasks
  for each row execute function force_owner_tasks();
create trigger guard_reassign before update on tasks
  for each row execute function guard_reassign_tasks();

-- Role escalation guard: a producer can update their own profile row (e.g.
-- full_name) but never their own role; only an admin can change anyone's
-- role. Implemented as a trigger (direct OLD/NEW access) rather than an RLS
-- WITH CHECK, which cannot compare against the pre-update row.

create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and new.role is distinct from old.role then
    raise exception 'Only an admin can change a user role';
  end if;
  return new;
end;
$$;

revoke all on function prevent_self_role_escalation() from public;

create trigger prevent_self_role_escalation before update on profiles
  for each row execute function prevent_self_role_escalation();

-- ── Policies: agencies ────────────────────────────────────────────────────
-- No INSERT/DELETE policy for the `authenticated` role at all — default
-- deny. The only way an agency row is ever created is the seed migration
-- or scripts/bootstrap-admin.ts, both running as the Postgres owner /
-- service role, which bypasses RLS by design.

create policy agencies_select on agencies for select
  using (id = current_agency_id());

create policy agencies_update on agencies for update
  using (id = current_agency_id() and is_admin())
  with check (id = current_agency_id() and is_admin());

-- ── Policies: profiles ────────────────────────────────────────────────────

create policy profiles_select on profiles for select
  using (agency_id = current_agency_id());

create policy profiles_insert on profiles for insert
  with check (agency_id = current_agency_id() and is_admin());

create policy profiles_update on profiles for update
  using (agency_id = current_agency_id() and (id = auth.uid() or is_admin()))
  with check (agency_id = current_agency_id() and (id = auth.uid() or is_admin()));

create policy profiles_delete on profiles for delete
  using (agency_id = current_agency_id() and is_admin());

-- ── Policies: clients ─────────────────────────────────────────────────────
-- No hard DELETE offered by the app (Phase 1/4 UI is archive/restore via
-- UPDATE archived_at); the DELETE policy exists as a documented admin-only
-- database-level escape hatch, e.g. a GDPR-style erasure request.

create policy clients_select on clients for select
  using (agency_id = current_agency_id() and owns_or_admin(assigned_producer_id));

create policy clients_insert on clients for insert
  with check (agency_id = current_agency_id());

create policy clients_update on clients for update
  using (agency_id = current_agency_id() and owns_or_admin(assigned_producer_id))
  with check (agency_id = current_agency_id());

create policy clients_delete on clients for delete
  using (agency_id = current_agency_id() and is_admin());

-- ── Policies: leads / quotes / policies (identical shape) ────────────────

create policy leads_select on leads for select
  using (agency_id = current_agency_id() and owns_or_admin(producer_id));
create policy leads_insert on leads for insert
  with check (agency_id = current_agency_id());
create policy leads_update on leads for update
  using (agency_id = current_agency_id() and owns_or_admin(producer_id))
  with check (agency_id = current_agency_id());
create policy leads_delete on leads for delete
  using (agency_id = current_agency_id() and is_admin());

create policy quotes_select on quotes for select
  using (agency_id = current_agency_id() and owns_or_admin(producer_id));
create policy quotes_insert on quotes for insert
  with check (agency_id = current_agency_id());
create policy quotes_update on quotes for update
  using (agency_id = current_agency_id() and owns_or_admin(producer_id))
  with check (agency_id = current_agency_id());
create policy quotes_delete on quotes for delete
  using (agency_id = current_agency_id() and is_admin());

create policy policies_select on policies for select
  using (agency_id = current_agency_id() and owns_or_admin(producer_id));
create policy policies_insert on policies for insert
  with check (agency_id = current_agency_id());
create policy policies_update on policies for update
  using (agency_id = current_agency_id() and owns_or_admin(producer_id))
  with check (agency_id = current_agency_id());
create policy policies_delete on policies for delete
  using (agency_id = current_agency_id() and is_admin());

-- ── Policies: tasks ───────────────────────────────────────────────────────

create policy tasks_select on tasks for select
  using (agency_id = current_agency_id() and owns_or_admin(assigned_to));
create policy tasks_insert on tasks for insert
  with check (agency_id = current_agency_id());
create policy tasks_update on tasks for update
  using (agency_id = current_agency_id() and owns_or_admin(assigned_to))
  with check (agency_id = current_agency_id());
create policy tasks_delete on tasks for delete
  using (agency_id = current_agency_id() and owns_or_admin(assigned_to));

-- ── Policies: family_members / client_notes / documents ──────────────────
-- These have no owner column of their own — visibility follows the parent
-- client's assigned_producer_id. documents.client_id is nullable
-- (agency-level docs): when null, any agency member can access; when set,
-- defer to the parent client.

create policy family_members_select on family_members for select
  using (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = family_members.client_id and owns_or_admin(c.assigned_producer_id)
    )
  );
create policy family_members_insert on family_members for insert
  with check (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = family_members.client_id and owns_or_admin(c.assigned_producer_id)
    )
  );
create policy family_members_update on family_members for update
  using (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = family_members.client_id and owns_or_admin(c.assigned_producer_id)
    )
  )
  with check (agency_id = current_agency_id());
create policy family_members_delete on family_members for delete
  using (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = family_members.client_id and owns_or_admin(c.assigned_producer_id)
    )
  );

create policy client_notes_select on client_notes for select
  using (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = client_notes.client_id and owns_or_admin(c.assigned_producer_id)
    )
  );
create policy client_notes_insert on client_notes for insert
  with check (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = client_notes.client_id and owns_or_admin(c.assigned_producer_id)
    )
  );
create policy client_notes_update on client_notes for update
  using (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = client_notes.client_id and owns_or_admin(c.assigned_producer_id)
    )
  )
  with check (agency_id = current_agency_id());
create policy client_notes_delete on client_notes for delete
  using (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = client_notes.client_id and owns_or_admin(c.assigned_producer_id)
    )
  );

create policy documents_select on documents for select
  using (
    agency_id = current_agency_id()
    and (
      client_id is null
      or exists (
        select 1 from clients c
        where c.id = documents.client_id and owns_or_admin(c.assigned_producer_id)
      )
    )
  );
create policy documents_insert on documents for insert
  with check (
    agency_id = current_agency_id()
    and (
      client_id is null
      or exists (
        select 1 from clients c
        where c.id = documents.client_id and owns_or_admin(c.assigned_producer_id)
      )
    )
  );
create policy documents_update on documents for update
  using (
    agency_id = current_agency_id()
    and (
      client_id is null
      or exists (
        select 1 from clients c
        where c.id = documents.client_id and owns_or_admin(c.assigned_producer_id)
      )
    )
  )
  with check (agency_id = current_agency_id());
create policy documents_delete on documents for delete
  using (
    agency_id = current_agency_id()
    and (
      is_admin()
      or (
        client_id is not null
        and exists (
          select 1 from clients c
          where c.id = documents.client_id and owns_or_admin(c.assigned_producer_id)
        )
      )
    )
  );

-- ── Policies: notifications ───────────────────────────────────────────────

create policy notifications_select on notifications for select
  using (user_id = auth.uid());
create policy notifications_update on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy notifications_delete on notifications for delete
  using (user_id = auth.uid());
-- No authenticated-role INSERT policy: notifications are system-generated
-- (future trigger/server-side job), not written directly by the app.

-- ── Policies: activity_log ────────────────────────────────────────────────
-- Admin-only read. No INSERT/UPDATE/DELETE policy for `authenticated` at
-- all — this table is populated by SECURITY DEFINER triggers added in
-- Phase 4, not by direct client writes, and is never mutated after insert.

create policy activity_log_select on activity_log for select
  using (agency_id = current_agency_id() and is_admin());
