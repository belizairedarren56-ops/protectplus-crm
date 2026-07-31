-- ProtectPlus CRM — Phase 2 foundation: schema
--
-- Single-agency deployment today, multi-tenant-ready schema: every business
-- table carries agency_id from this first migration, even though only one
-- agency row will ever exist in this phase (see 20260801000004_seed_agency).
-- No application data is migrated in this phase — this file only creates
-- structure.

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────

create type user_role as enum ('admin', 'producer');
create type client_status as enum ('New Lead', 'Active', 'Prospect', 'Inactive', 'Lost');
create type insurance_type as enum (
  'Auto', 'Home', 'Commercial', 'Life', 'Health', 'Boat', 'Umbrella', 'Flood'
);
create type lead_stage as enum (
  'New', 'Contacted', 'Quote Started', 'Quote Sent', 'Follow Up', 'Sold', 'Renewal', 'Lost'
);
create type priority_level as enum ('Low', 'Medium', 'High');
create type quote_status as enum ('Draft', 'Sent', 'Accepted', 'Declined', 'Expired');
create type policy_status as enum ('Active', 'Renewal Due', 'Cancelled', 'Expired');
create type task_status as enum ('Open', 'Complete');
create type document_folder as enum (
  'Applications', 'Declarations', 'Driver Licenses', 'Vehicle Photos',
  'Property Photos', 'Commercial Documents', 'Medical Documents'
);

-- ── Root: agencies ───────────────────────────────────────────────────────
-- No created_by/updated_by here: this is the tenancy root, created before
-- any profile exists to be the "creator" (see 0004's seed and
-- scripts/bootstrap-admin.ts).

create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  primary_color text,
  secondary_color text,
  accent_color text,
  carriers text[] not null default '{}',
  commission_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── profiles (1:1 with auth.users) ──────────────────────────────────────
-- Same reasoning as agencies: the first profile has no inviting profile to
-- record as created_by. Later profiles' created_by is set by the
-- server-only invite flow (Phase 4), not a generic trigger.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  agency_id uuid not null references agencies (id),
  role user_role not null default 'producer',
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id) -- composite-FK target for every ownership column below
);

-- ── clients ──────────────────────────────────────────────────────────────

create table clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  assigned_producer_id uuid,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  status client_status not null default 'New Lead',
  address text,
  city text,
  state text,
  zip text,
  carrier text,
  policy_number text,
  insurance_types insurance_type[] not null default '{}',
  archived_at timestamptz,
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id)
);

-- Composite FK: a client's assigned producer must belong to the SAME
-- agency as the client. agency_id alone next to a bare uuid FK does not
-- guarantee this — see the isolation test in tests/rls/composite-fk.
alter table clients
  add constraint clients_producer_same_agency
  foreign key (assigned_producer_id, agency_id) references profiles (id, agency_id);

-- ── family_members ──────────────────────────────────────────────────────

create table family_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  client_id uuid not null,
  name text not null,
  relationship text not null,
  date_of_birth date,
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, agency_id) references clients (id, agency_id) on delete cascade
);

-- ── leads ────────────────────────────────────────────────────────────────

create table leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  client_id uuid,
  producer_id uuid not null,
  client_name text not null,
  insurance_type insurance_type not null,
  stage lead_stage not null default 'New',
  priority priority_level not null default 'Medium',
  last_contact timestamptz,
  phone text,
  email text,
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, agency_id) references clients (id, agency_id),
  foreign key (producer_id, agency_id) references profiles (id, agency_id)
);

-- ── quotes ───────────────────────────────────────────────────────────────

create table quotes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  client_id uuid not null,
  producer_id uuid not null,
  client_name text not null,
  carrier text not null,
  premium numeric(12, 2) not null,
  coverage text,
  insurance_type insurance_type not null,
  status quote_status not null default 'Draft',
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, agency_id) references clients (id, agency_id),
  foreign key (producer_id, agency_id) references profiles (id, agency_id)
);

-- ── policies ─────────────────────────────────────────────────────────────

create table policies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  client_id uuid not null,
  producer_id uuid not null,
  client_name text not null,
  carrier text not null,
  policy_number text not null,
  product insurance_type not null,
  effective_date date not null,
  expiration_date date not null,
  status policy_status not null default 'Active',
  premium numeric(12, 2) not null,
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, agency_id) references clients (id, agency_id),
  foreign key (producer_id, agency_id) references profiles (id, agency_id)
);

-- ── tasks ────────────────────────────────────────────────────────────────

create table tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  client_id uuid,
  assigned_to uuid not null,
  title text not null,
  description text,
  priority priority_level not null default 'Medium',
  due_date date not null,
  status task_status not null default 'Open',
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, agency_id) references clients (id, agency_id),
  foreign key (assigned_to, agency_id) references profiles (id, agency_id)
);

-- ── documents (metadata only — no real uploads in this phase) ──────────

create table documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  client_id uuid,
  folder document_folder not null,
  name text not null,
  file_type text,
  storage_path text, -- reserved for the real-upload phase; unused today
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, agency_id) references clients (id, agency_id)
);

-- ── client_notes (replaces the raw string-keyed localStorage note) ──────

create table client_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  client_id uuid not null,
  body text not null default '',
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, agency_id) references clients (id, agency_id) on delete cascade
);

-- ── notifications (already inherently per-user) ─────────────────────────

create table notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  user_id uuid not null references profiles (id),
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── activity_log (append-only; populated by triggers added in Phase 4) ──

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id),
  actor_id uuid references profiles (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes on foreign keys (Postgres does not create these automatically) ──

create index clients_agency_id_idx on clients (agency_id);
create index clients_assigned_producer_id_idx on clients (assigned_producer_id);
create index family_members_client_id_idx on family_members (client_id);
create index leads_agency_id_idx on leads (agency_id);
create index leads_producer_id_idx on leads (producer_id);
create index leads_client_id_idx on leads (client_id);
create index quotes_agency_id_idx on quotes (agency_id);
create index quotes_producer_id_idx on quotes (producer_id);
create index quotes_client_id_idx on quotes (client_id);
create index policies_agency_id_idx on policies (agency_id);
create index policies_producer_id_idx on policies (producer_id);
create index policies_client_id_idx on policies (client_id);
create index tasks_agency_id_idx on tasks (agency_id);
create index tasks_assigned_to_idx on tasks (assigned_to);
create index tasks_client_id_idx on tasks (client_id);
create index documents_agency_id_idx on documents (agency_id);
create index documents_client_id_idx on documents (client_id);
create index client_notes_client_id_idx on client_notes (client_id);
create index notifications_user_id_idx on notifications (user_id);
create index activity_log_agency_id_idx on activity_log (agency_id);
create index activity_log_entity_idx on activity_log (entity_type, entity_id);
