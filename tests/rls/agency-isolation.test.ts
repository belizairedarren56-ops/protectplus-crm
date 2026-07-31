import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestAgency,
  createTestUser,
  deleteTestAgency,
  deleteTestUser,
  serviceClient,
  type TestUser,
} from "./helpers";

// Proves a user in Agency A can never read or write Agency B's rows, across
// every RLS pattern used in the schema: direct-ownership tables (clients),
// parent-join tables (family_members), and the agency-scoped root tables
// themselves (agencies, profiles).

const admin = serviceClient();

let agencyA: string;
let agencyB: string;
let producerA: TestUser;
let producerB: TestUser;
let clientInA: string;
let familyMemberInA: string;

beforeAll(async () => {
  agencyA = await createTestAgency(admin, `Agency A ${Date.now()}`);
  agencyB = await createTestAgency(admin, `Agency B ${Date.now()}`);

  producerA = await createTestUser(admin, {
    agencyId: agencyA,
    role: "producer",
    fullName: "Producer A",
  });
  producerB = await createTestUser(admin, {
    agencyId: agencyB,
    role: "producer",
    fullName: "Producer B",
  });

  const { data: client, error: clientError } = await producerA.client
    .from("clients")
    .insert({ agency_id: agencyA, first_name: "Jane", last_name: "Cooper" })
    .select("id")
    .single();
  if (clientError) throw clientError;
  clientInA = (client as { id: string }).id;

  const { data: familyMember, error: familyError } = await producerA.client
    .from("family_members")
    .insert({ agency_id: agencyA, client_id: clientInA, name: "Sam Cooper", relationship: "Spouse" })
    .select("id")
    .single();
  if (familyError) throw familyError;
  familyMemberInA = (familyMember as { id: string }).id;
});

afterAll(async () => {
  await deleteTestUser(admin, producerA.userId);
  await deleteTestUser(admin, producerB.userId);
  await deleteTestAgency(admin, agencyA);
  await deleteTestAgency(admin, agencyB);
});

describe("agency isolation", () => {
  it("a producer in Agency B cannot see a client that belongs to Agency A", async () => {
    const { data, error } = await producerB.client.from("clients").select("id").eq("id", clientInA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a producer in Agency B cannot update a client that belongs to Agency A", async () => {
    const { data } = await producerB.client
      .from("clients")
      .update({ first_name: "Hijacked" })
      .eq("id", clientInA)
      .select();
    expect(data).toEqual([]); // RLS silently filters — zero rows affected, not an error

    const { data: stillOriginal } = await admin.from("clients").select("first_name").eq("id", clientInA).single();
    expect((stillOriginal as { first_name: string }).first_name).toBe("Jane");
  });

  it("a producer in Agency B cannot see a family member via Agency A's client (parent-join policy)", async () => {
    const { data, error } = await producerB.client
      .from("family_members")
      .select("id")
      .eq("id", familyMemberInA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a producer cannot see another agency's profile rows", async () => {
    const { data, error } = await producerB.client.from("profiles").select("id").eq("id", producerA.userId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a producer cannot see another agency's row in the agencies table", async () => {
    const { data, error } = await producerB.client.from("agencies").select("id").eq("id", agencyA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a producer in Agency B cannot insert a client directly into Agency A", async () => {
    const { data, error } = await producerB.client
      .from("clients")
      .insert({ agency_id: agencyA, first_name: "Intruder", last_name: "Smith" })
      .select();
    // Blocked either by the INSERT policy's WITH CHECK (agency_id must match
    // the caller's own) or the composite FK if it gets further — either way,
    // no row may be created.
    expect(data ?? []).toEqual([]);
    expect(error).not.toBeNull();
  });
});
