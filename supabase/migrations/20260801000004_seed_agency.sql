-- ProtectPlus CRM — Phase 2 foundation: the tenancy root
--
-- Exactly one agency row — this is schema/infrastructure, not application
-- data. Migrations run as the Postgres owner role, which bypasses RLS by
-- construction, so there's no chicken-and-egg problem creating this before
-- any profile/admin exists. The first admin *profile* is created separately
-- by scripts/bootstrap-admin.ts (never by a migration, since that involves
-- Supabase Auth's user-creation APIs, not a plain SQL insert).
--
-- Only the stable id and the confirmed business name are seeded here. Phone,
-- email, address, and the carrier list were never confirmed business
-- details — they were invented placeholder values in an earlier version of
-- this migration and have been removed. Agency Settings (Phase 1's existing
-- UI, later wired to this table) is where an admin enters the real values.
-- If this migration already ran against a database with those invented
-- fields, see 20260801000005_clear_invented_agency_details.sql.

insert into agencies (id, name)
values (
  '00000000-0000-0000-0000-000000000001',
  'ProtectPlus Insurance'
)
on conflict (id) do nothing;
