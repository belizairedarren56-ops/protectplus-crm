import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestAgency, createTestUser, deleteTestAgency, deleteTestUser, serviceClient } from "./helpers";

// The gap this closes: `agency_id` sitting next to `client_id`/`producer_id`
// does not, by itself, stop a row from pointing at a client or producer in a
// *different* agency — nothing checks that the two agree unless the FK
// itself is composite. This connects as the SERVICE ROLE, deliberately
// bypassing RLS, so a failure here proves the DATABASE CONSTRAINT is what's
// blocking the row — not RLS, which wouldn't catch this at all (RLS only
// checks the row's own agency_id against the caller's agency, never that a
// referenced foreign row belongs to the same agency).

const admin = serviceClient();

let agencyA: string;
let agencyB: string;
let clientInA: string;
let producerInA: string;

beforeAll(async () => {
  agencyA = await createTestAgency(admin, `FK Agency A ${Date.now()}`);
  agencyB = await createTestAgency(admin, `FK Agency B ${Date.now()}`);

  const producer = await createTestUser(admin, { agencyId: agencyA, role: "producer", fullName: "Producer" });
  producerInA = producer.userId;

  const { data: client, error } = await admin
    .from("clients")
    .insert({ agency_id: agencyA, first_name: "Jane", last_name: "Cooper", assigned_producer_id: producerInA })
    .select("id")
    .single();
  if (error) throw error;
  clientInA = (client as { id: string }).id;
});

afterAll(async () => {
  await deleteTestUser(admin, producerInA);
  await deleteTestAgency(admin, agencyA);
  await deleteTestAgency(admin, agencyB);
});

describe("composite foreign keys reject cross-agency references (service role, RLS bypassed)", () => {
  it("rejects a policy claiming Agency B but referencing a client from Agency A", async () => {
    const { error } = await admin.from("policies").insert({
      agency_id: agencyB,
      client_id: clientInA, // belongs to Agency A
      producer_id: producerInA,
      client_name: "Jane Cooper",
      carrier: "State Farm",
      policy_number: "SF-0000001",
      product: "Auto",
      effective_date: "2026-01-01",
      expiration_date: "2026-07-01",
      premium: 1000,
    });
    expect(error).not.toBeNull();
    // Specifically the FK, not just "some constraint or other" — a loose
    // match here would let a missing-column bug in the test itself pass
    // for the wrong reason (as happened with client_name before this fix).
    expect(error?.message).toMatch(/foreign key/i);
  });

  it("rejects a policy claiming Agency B but referencing a producer from Agency A", async () => {
    const { data: clientInB, error: clientError } = await admin
      .from("clients")
      .insert({ agency_id: agencyB, first_name: "Someone", last_name: "Else" })
      .select("id")
      .single();
    if (clientError) throw clientError;

    const { error } = await admin.from("policies").insert({
      agency_id: agencyB,
      client_id: (clientInB as { id: string }).id,
      producer_id: producerInA, // belongs to Agency A
      client_name: "Someone Else",
      carrier: "State Farm",
      policy_number: "SF-0000002",
      product: "Auto",
      effective_date: "2026-01-01",
      expiration_date: "2026-07-01",
      premium: 1000,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/foreign key/i);
  });

  it("rejects a client whose assigned_producer_id belongs to a different agency", async () => {
    const { error } = await admin.from("clients").insert({
      agency_id: agencyB,
      first_name: "Cross",
      last_name: "Agency",
      assigned_producer_id: producerInA, // belongs to Agency A
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/foreign key/i);
  });

  it("rejects a task whose client belongs to a different agency than the task", async () => {
    const { error } = await admin.from("tasks").insert({
      agency_id: agencyB,
      client_id: clientInA, // belongs to Agency A
      assigned_to: producerInA,
      title: "Cross-agency task",
      due_date: "2026-01-01",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/foreign key/i);
  });

  it("accepts a policy where agency_id, client_id, and producer_id all agree", async () => {
    const { error } = await admin.from("policies").insert({
      agency_id: agencyA,
      client_id: clientInA,
      producer_id: producerInA,
      client_name: "Jane Cooper",
      carrier: "State Farm",
      policy_number: "SF-0000003",
      product: "Auto",
      effective_date: "2026-01-01",
      expiration_date: "2026-07-01",
      premium: 1000,
    });
    expect(error).toBeNull();
  });
});
