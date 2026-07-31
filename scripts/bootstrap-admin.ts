/**
 * One-time, human-run bootstrap: creates the first admin user + profile for
 * the ProtectPlus agency.
 *
 * This is a LOCAL SCRIPT, never an HTTP route — there is no equivalent
 * endpoint anywhere in the app. It must be run directly by whoever holds
 * the project's service-role key (which bypasses RLS entirely, which is
 * exactly why this can't be a route: nothing reachable over HTTP should
 * ever hold that key). Ordinary admin invites after this first one go
 * through the in-app "User Management" flow (Phase 4), which re-verifies
 * the *caller's* session and admin role server-side before doing anything.
 *
 * Idempotent: refuses to run again once the agency already has an admin.
 * Refuses to target anything other than a local Supabase instance unless
 * you type the agency's exact name to confirm — the same "explicit human
 * step" treatment given to every other hosted-project action in this repo.
 *
 * Usage:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/bootstrap-admin.ts --email you@example.com --name "Your Name" --password "..."
 */

import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";

// Matches the id inserted by supabase/migrations/20260801000004_seed_agency.sql.
const AGENCY_ID = "00000000-0000-0000-0000-000000000001";
const AGENCY_NAME = "ProtectPlus Insurance";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function confirmHostedTarget(url: string): Promise<void> {
  const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
  if (isLocal) return;

  console.log(`\nTarget URL: ${url}`);
  console.log("This does not look like a local Supabase instance.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = await rl.question(
    `Type the exact agency name "${AGENCY_NAME}" to confirm you intend to bootstrap an admin on this HOSTED project: `
  );
  rl.close();

  if (typed.trim() !== AGENCY_NAME) {
    console.error("Confirmation text did not match. Aborting — nothing was created.");
    process.exit(1);
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script."
    );
    process.exit(1);
  }

  const email = arg("email");
  const fullName = arg("name");
  const password = arg("password");

  if (!email || !fullName || !password) {
    console.error(
      'Usage: npx tsx scripts/bootstrap-admin.ts --email <email> --name "<full name>" --password <password>'
    );
    process.exit(1);
  }

  await confirmHostedTarget(url);

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingAdmins, error: checkError } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("agency_id", AGENCY_ID)
    .eq("role", "admin");

  if (checkError) {
    console.error("Could not check for an existing admin:", checkError.message);
    process.exit(1);
  }

  if (existingAdmins && existingAdmins.length > 0) {
    console.error(
      `This agency already has ${existingAdmins.length} admin profile(s): ` +
        `${existingAdmins.map((p) => p.full_name).join(", ")}. Refusing to bootstrap another — ` +
        "use the in-app User Management invite flow instead."
    );
    process.exit(1);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    console.error("Could not create the auth user:", createError?.message);
    process.exit(1);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    agency_id: AGENCY_ID,
    role: "admin",
    full_name: fullName,
  });

  if (profileError) {
    console.error("Auth user was created, but the admin profile insert failed:", profileError.message);
    console.error(
      `Auth user id ${created.user.id} now exists with no profile — clean it up manually before retrying.`
    );
    process.exit(1);
  }

  console.log(`\nDone. Admin profile created for ${email} (${fullName}).`);
}

main();
