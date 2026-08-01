-- Corrective migration: the original tenancy-root seed
-- (20260801000004_seed_agency.sql) briefly included invented placeholder
-- values — a fake phone number, email, street address, and a full carrier
-- list — that were never confirmed real business details. That file has
-- since been corrected to seed only the stable id and business name. This
-- migration clears those invented fields on any database where the old
-- version already ran, bringing it in line with the corrected seed.
--
-- Scoped to the one seeded agency id, and only touches the specific
-- placeholder values this migration set originally introduced — never
-- overwrites anything an admin has since entered through Agency Settings.

update agencies
set
  phone = null,
  email = null,
  address = null,
  carriers = '{}'
where id = '00000000-0000-0000-0000-000000000001'
  and phone = '954-555-0100'
  and email = 'hello@protectplus.com'
  and address = '100 Las Olas Blvd, Fort Lauderdale, FL 33301';
