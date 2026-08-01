import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestAgency, createTestUser, deleteTestAgency, deleteTestUser, serviceClient } from "./helpers";

// Completes the composite-FK coverage from composite-fk-isolation.test.ts:
// created_by/updated_by (every business table), notifications.user_id, and
// activity_log.actor_id must also agree with their row's own agency_id —
// not just the *ownership* columns (client_id/producer_id/assigned_to)
// tested there. Connects as the service role, deliberately bypassing RLS,
// so a failure here proves the constraint — not RLS or app-layer discipline
// — is what's rejecting the row.

const admin = serviceClient();

let agencyA: string;
let agencyB: string;
let userInA: string;
let clientInA: string;

beforeAll(async () => {
  agencyA = await createTestAgency(admin, `Audit FK Agency A ${Date.now()}`);
  agencyB = await createTestAgency(admin, `Audit FK Agency B ${Date.now()}`);

  const user = await createTestUser(admin, { agencyId: agencyA, role: "producer", fullName: "User In A" });
  userInA = user.userId;

  const { data: client, error } = await admin
    .from("clients")
    .insert({ agency_id: agencyA, first_name: "Jane", last_name: "Cooper" })
    .select("id")
    .single();
  if (error) throw error;
  clientInA = (client as { id: string }).id;
});

afterAll(async () => {
  await deleteTestUser(admin, userInA);
  await deleteTestAgency(admin, agencyA);
  await deleteTestAgency(admin, agencyB);
});

describe("composite FKs on audit/actor columns reject cross-agency references", () => {
  it("rejects a client whose created_by belongs to a different agency", async () => {
    const { error } = await admin.from("clients").insert({
      agency_id: agencyB,
      first_name: "Cross",
      last_name: "Agency",
      created_by: userInA, // belongs to Agency A
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/foreign key/i);
  });

  it("rejects a client whose updated_by belongs to a different agency", async () => {
    const { error } = await admin.from("clients").insert({
      agency_id: agencyB,
      first_name: "Cross",
      last_name: "Agency",
      updated_by: userInA, // belongs to Agency A
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/foreign key/i);
  });

  it("accepts a client whose created_by/updated_by belong to the same agency", async () => {
    const { error } = await admin.from("clients").insert({
      agency_id: agencyA,
      first_name: "Same",
      last_name: "Agency",
      created_by: userInA,
      updated_by: userInA,
    });
    expect(error).toBeNull();
  });

  it("rejects a notification whose user_id belongs to a different agency", async () => {
    const { error } = await admin.from("notifications").insert({
      agency_id: agencyB,
      user_id: userInA, // belongs to Agency A
      type: "task",
      message: "Cross-agency notification",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/foreign key/i);
  });

  it("rejects an activity_log row whose actor_id belongs to a different agency", async () => {
    const { error } = await admin.from("activity_log").insert({
      agency_id: agencyB,
      actor_id: userInA, // belongs to Agency A
      entity_type: "clients",
      entity_id: clientInA,
      action: "update",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/foreign key/i);
  });

  it("accepts an activity_log row whose actor_id belongs to the same agency", async () => {
    const { error } = await admin.from("activity_log").insert({
      agency_id: agencyA,
      actor_id: userInA,
      entity_type: "clients",
      entity_id: clientInA,
      action: "update",
    });
    expect(error).toBeNull();
  });
});
