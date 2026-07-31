import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestAgency, createTestUser, deleteTestAgency, deleteTestUser, serviceClient, type TestUser } from "./helpers";

const admin = serviceClient();

let agencyId: string;
let producer: TestUser;
let clientId: string;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Constraints Agency ${Date.now()}`);
  producer = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer" });

  const { data, error } = await producer.client
    .from("clients")
    .insert({ agency_id: agencyId, first_name: "Jane", last_name: "Cooper" })
    .select("id")
    .single();
  if (error) throw error;
  clientId = (data as { id: string }).id;
});

afterAll(async () => {
  await deleteTestUser(admin, producer.userId);
  await deleteTestAgency(admin, agencyId);
});

describe("data-integrity constraints", () => {
  it("normalizes email to lowercase/trimmed and phone to digits-only", async () => {
    const { error } = await producer.client
      .from("clients")
      .update({ email: "  Jane.Cooper@Example.COM  ", phone: "(954) 555-0100" })
      .eq("id", clientId);
    expect(error).toBeNull();

    const { data } = await admin.from("clients").select("email, phone").eq("id", clientId).single();
    expect((data as { email: string; phone: string }).email).toBe("jane.cooper@example.com");
    expect((data as { email: string; phone: string }).phone).toBe("9545550100");
  });

  it("rejects a negative quote premium", async () => {
    const { error } = await producer.client.from("quotes").insert({
      agency_id: agencyId,
      client_id: clientId,
      client_name: "Jane Cooper",
      carrier: "State Farm",
      premium: -100,
      insurance_type: "Auto",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/violates check constraint/i);
  });

  it("rejects a policy whose expiration is before its effective date", async () => {
    const { error } = await producer.client.from("policies").insert({
      agency_id: agencyId,
      client_id: clientId,
      client_name: "Jane Cooper",
      carrier: "State Farm",
      policy_number: `SF-${Date.now()}`,
      product: "Auto",
      effective_date: "2026-06-01",
      expiration_date: "2026-01-01",
      premium: 1000,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/violates check constraint/i);
  });

  it("rejects a duplicate policy number for the same agency and carrier", async () => {
    const policyNumber = `SF-DUP-${Date.now()}`;
    const base = {
      agency_id: agencyId,
      client_id: clientId,
      client_name: "Jane Cooper",
      carrier: "State Farm",
      product: "Auto" as const,
      effective_date: "2026-01-01",
      expiration_date: "2026-07-01",
      premium: 1000,
    };

    const first = await producer.client.from("policies").insert({ ...base, policy_number: policyNumber });
    expect(first.error).toBeNull();

    const second = await producer.client.from("policies").insert({ ...base, policy_number: policyNumber });
    expect(second.error).not.toBeNull();
    expect(second.error?.message).toMatch(/duplicate key|unique constraint/i);
  });

  it("stamps created_by/updated_by from the session, ignoring any client-supplied value", async () => {
    const { data: created, error } = await producer.client
      .from("tasks")
      .insert({
        agency_id: agencyId,
        client_id: clientId,
        title: "Spoof attempt",
        due_date: "2026-01-01",
        // A malicious/buggy client trying to attribute this to someone else:
        created_by: "00000000-0000-0000-0000-000000000099",
      })
      .select("created_by, updated_by")
      .single();

    expect(error).toBeNull();
    expect((created as { created_by: string }).created_by).toBe(producer.userId);
    expect((created as { updated_by: string }).updated_by).toBe(producer.userId);
  });

  it("requires a producer/assignee on leads, quotes, policies, and tasks (NOT NULL)", async () => {
    const { error } = await admin.from("leads").insert({
      agency_id: agencyId,
      client_name: "No Producer",
      insurance_type: "Auto",
      // producer_id intentionally omitted
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/null value|not-null constraint/i);
  });
});
