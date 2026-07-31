-- ProtectPlus CRM — Phase 2 foundation: constraints beyond foreign keys
--
-- CHECK constraints, uniqueness, and triggers for auditability/normalization
-- that a foreign key alone doesn't give you.

-- ── Non-negative premiums ────────────────────────────────────────────────

alter table quotes add constraint quotes_premium_nonneg check (premium >= 0);
alter table policies add constraint policies_premium_nonneg check (premium >= 0);

-- ── Effective date before expiration ─────────────────────────────────────

alter table policies
  add constraint policies_effective_before_expiration check (effective_date < expiration_date);

-- ── Unique policy numbers (scoped per agency + carrier — two different
--    agencies, or two different carriers, may coincidentally reuse a
--    number format, but the same carrier within the same agency must not) ──

alter table policies
  add constraint policies_unique_number unique (agency_id, carrier, policy_number);

-- ── updated_at auto-bump ─────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function set_updated_at() from public;

create trigger set_updated_at before update on agencies
  for each row execute function set_updated_at();
create trigger set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger set_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger set_updated_at before update on family_members
  for each row execute function set_updated_at();
create trigger set_updated_at before update on leads
  for each row execute function set_updated_at();
create trigger set_updated_at before update on quotes
  for each row execute function set_updated_at();
create trigger set_updated_at before update on policies
  for each row execute function set_updated_at();
create trigger set_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger set_updated_at before update on documents
  for each row execute function set_updated_at();
create trigger set_updated_at before update on client_notes
  for each row execute function set_updated_at();

-- ── created_by / updated_by stamping ─────────────────────────────────────
-- Always derived from auth.uid() server-side — never trusted from client
-- input. Not applied to agencies/profiles: those two root tables are only
-- ever written by the migration-time seed or the server-only bootstrap/
-- invite scripts, not through ordinary authenticated app traffic, so a
-- generic actor-stamping trigger adds no real value there (and profiles
-- referencing itself as created_by for the very first row has no sensible
-- value anyway).

create or replace function stamp_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

revoke all on function stamp_actor() from public;

create trigger stamp_actor before insert or update on clients
  for each row execute function stamp_actor();
create trigger stamp_actor before insert or update on family_members
  for each row execute function stamp_actor();
create trigger stamp_actor before insert or update on leads
  for each row execute function stamp_actor();
create trigger stamp_actor before insert or update on quotes
  for each row execute function stamp_actor();
create trigger stamp_actor before insert or update on policies
  for each row execute function stamp_actor();
create trigger stamp_actor before insert or update on tasks
  for each row execute function stamp_actor();
create trigger stamp_actor before insert or update on documents
  for each row execute function stamp_actor();
create trigger stamp_actor before insert or update on client_notes
  for each row execute function stamp_actor();

-- ── Email / phone normalization ──────────────────────────────────────────

create or replace function normalize_contact_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null then
    new.email = lower(trim(new.email));
  end if;
  if new.phone is not null then
    new.phone = regexp_replace(new.phone, '[^0-9]', '', 'g');
  end if;
  return new;
end;
$$;

revoke all on function normalize_contact_fields() from public;

create trigger normalize_contact before insert or update on clients
  for each row execute function normalize_contact_fields();
create trigger normalize_contact before insert or update on leads
  for each row execute function normalize_contact_fields();
