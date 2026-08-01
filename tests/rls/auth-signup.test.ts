import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createTestAgency,
  createTestUser,
  deleteTestAgency,
  deleteTestUser,
  serviceClient,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./helpers";

// This is an internal, admin-invited-only CRM (see scripts/bootstrap-admin.ts
// and the future in-app invite flow) — public self-serve signup must never
// be possible. Both `[auth] enable_signup` and `[auth.email] enable_signup`
// are set to false in supabase/config.toml; this proves that setting is
// doing something, and that it doesn't also break the admin-creation path.
describe("public signup is disabled; admin-created accounts still work", () => {
  it("rejects an anonymous public signup attempt", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await anon.auth.signUp({
      email: `${randomUUID()}@example.test`,
      password: "Some-password-123!",
    });

    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("the service-role admin API can still create a usable account (bootstrap/invite path)", async () => {
    const admin = serviceClient();
    const agencyId = await createTestAgency(admin, `Signup Test Agency ${Date.now()}`);

    // createTestUser (tests/rls/helpers.ts) creates the account via
    // admin.auth.admin.createUser — the same admin API scripts/bootstrap-
    // admin.ts and the future in-app invite flow use — then signs in with
    // it, proving this path works even with public signup fully disabled.
    const user = await createTestUser(admin, {
      agencyId,
      role: "producer",
      fullName: "Admin-Created User",
    });
    expect(user.userId).toBeTruthy();

    const { data: session } = await user.client.auth.getSession();
    expect(session.session).not.toBeNull();

    await deleteTestUser(admin, user.userId);
    await deleteTestAgency(admin, agencyId);
  });
});
