import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// This whole suite only ever runs against a local `supabase start` instance
// (see .github/workflows/ci.yml's `supabase` job, or run it yourself with
// Docker running: `supabase start && npm run test:rls`). These are
// Supabase CLI's well-known, publicly-documented local-dev demo keys — the
// same ones every local Supabase project uses by default — never valid
// against a hosted project, safe to default here, overridable via env vars.
export const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestAgency(admin: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await admin
    .from("agencies")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteTestAgency(admin: SupabaseClient, agencyId: string | undefined): Promise<void> {
  if (!agencyId) return;
  await admin.from("agencies").delete().eq("id", agencyId);
}

export type TestUser = { client: SupabaseClient; userId: string; email: string };

export async function createTestUser(
  admin: SupabaseClient,
  opts: { agencyId: string; role: "admin" | "producer"; fullName: string }
): Promise<TestUser> {
  const email = `${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    throw createError ?? new Error("createUser returned no user");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    agency_id: opts.agencyId,
    role: opts.role,
    full_name: opts.fullName,
  });
  if (profileError) throw profileError;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { client, userId: created.user.id, email };
}

// Deleting the auth user cascades to its profile row (profiles.id has
// `on delete cascade` against auth.users). Always delete users before their
// agency — agencies has no cascade, so a lingering profile would block it.
//
// Guards against a missing/undefined id so that if a beforeAll fails
// part-way through setup, the afterAll cleanup doesn't throw its own
// confusing secondary error on top of the real one.
export async function deleteTestUser(admin: SupabaseClient, userId: string | undefined): Promise<void> {
  if (!userId) return;
  await admin.auth.admin.deleteUser(userId);
}
