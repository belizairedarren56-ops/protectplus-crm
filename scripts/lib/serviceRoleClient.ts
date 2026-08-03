import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Node-only. Never imported from anywhere under app/ — the service-role key
// is read only inside scripts/, exactly as established by
// scripts/bootstrap-admin.ts in Phase 2. Shared here so new Node scripts
// (scripts/migrate-clients-to-supabase.ts, repository integration test
// fixture setup) don't each re-implement the same "read env vars, exit if
// missing" boilerplate.
export function createServiceRoleClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script."
    );
    process.exit(1);
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
