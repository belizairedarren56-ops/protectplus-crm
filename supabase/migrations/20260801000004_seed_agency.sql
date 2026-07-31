-- ProtectPlus CRM — Phase 2 foundation: the tenancy root
--
-- Exactly one agency row — this is schema/infrastructure, not application
-- data. Migrations run as the Postgres owner role, which bypasses RLS by
-- construction, so there's no chicken-and-egg problem creating this before
-- any profile/admin exists. The first admin *profile* is created separately
-- by scripts/bootstrap-admin.ts (never by a migration, since that involves
-- Supabase Auth's user-creation APIs, not a plain SQL insert).

insert into agencies (id, name, phone, email, address, carriers)
values (
  '00000000-0000-0000-0000-000000000001',
  'ProtectPlus Insurance',
  '954-555-0100',
  'hello@protectplus.com',
  '100 Las Olas Blvd, Fort Lauderdale, FL 33301',
  array[
    'State Farm', 'Progressive', 'Allstate', 'Liberty Mutual', 'Travelers',
    'Nationwide', 'GEICO', 'Foremost', 'Citizens Property', 'Universal Property',
    'Safepoint', 'Chubb'
  ]
)
on conflict (id) do nothing;
