-- Corrective migration: complete same-agency composite FK coverage.
--
-- 0001_schema.sql made every *ownership* column (assigned_producer_id,
-- producer_id, assigned_to) a composite FK against (id, agency_id) on its
-- parent, but left the *audit trail* columns — created_by/updated_by on
-- every business table, notifications.user_id, activity_log.actor_id — as
-- plain FKs to profiles(id) alone. Nothing enforced that the actor
-- attributed to a row actually belongs to that row's own agency.
--
-- In normal operation this can't happen: stamp_actor() (0002) sets
-- created_by/updated_by from auth.uid(), and current_agency_id() (0003)
-- forces agency_id to the caller's own agency via RLS — so the two already
-- agree by construction *through the app*. This migration closes the gap
-- at the database level anyway, for the same reason every other ownership
-- column is composite: a future direct SQL statement, a trigger bug, or a
-- service-role write must not be able to attribute a row to a mismatched
-- agency's user, not just "shouldn't" via app-layer discipline.
--
-- Applied via DROP + ADD against Postgres's default single-column FK name
-- (`{table}_{column}_fkey`) rather than editing 0001 in place, so this
-- works identically whether 0001..0006 already ran (existing databases) or
-- are being applied fresh right now (new ones) — both replay this file.

-- stamp_actor() (0002) has the same service-role bug fixed for the
-- ownership-guard triggers in 0003: it unconditionally overwrites
-- created_by/updated_by with auth.uid(), which is NULL for a service-role
-- connection — so a service-role write could never set an explicit
-- created_by anyway, which also means there was no way to write a
-- database-level test proving the new composite FK below actually rejects
-- a mismatched one. Same fix, same reasoning: a NULL auth.uid() means "no
-- authenticated end-user session", already more trusted than anything RLS
-- mediates, so service-role writes are trusted as given. See
-- tests/rls/composite-fk-isolation.test.ts's "rejects a client whose
-- created_by belongs to a different agency" case, which only works because
-- of this fix.
create or replace function stamp_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_by = auth.uid();
    new.updated_by = auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by = old.created_by; -- immutable once set
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  audited_tables text[] := array[
    'clients', 'family_members', 'leads', 'quotes', 'policies',
    'tasks', 'documents', 'client_notes'
  ];
begin
  foreach t in array audited_tables loop
    execute format('alter table %I drop constraint if exists %I', t, t || '_created_by_fkey');
    execute format(
      'alter table %I add constraint %I foreign key (created_by, agency_id) references profiles (id, agency_id)',
      t, t || '_created_by_agency_fkey'
    );

    execute format('alter table %I drop constraint if exists %I', t, t || '_updated_by_fkey');
    execute format(
      'alter table %I add constraint %I foreign key (updated_by, agency_id) references profiles (id, agency_id)',
      t, t || '_updated_by_agency_fkey'
    );
  end loop;
end $$;

alter table notifications drop constraint if exists notifications_user_id_fkey;
alter table notifications
  add constraint notifications_user_agency_fkey
  foreign key (user_id, agency_id) references profiles (id, agency_id);

alter table activity_log drop constraint if exists activity_log_actor_id_fkey;
alter table activity_log
  add constraint activity_log_actor_agency_fkey
  foreign key (actor_id, agency_id) references profiles (id, agency_id);
