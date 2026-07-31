import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestAgency,
  createTestUser,
  deleteTestAgency,
  deleteTestUser,
  serviceClient,
  type TestUser,
} from "./helpers";

// Within a single agency: Producer A cannot see Producer B's assigned
// clients/leads/tasks; can see their own; the admin sees both. Also proves
// reassignment (changing who owns a row) is admin-only.

const admin = serviceClient();

let agencyId: string;
let adminUser: TestUser;
let producerA: TestUser;
let producerB: TestUser;
let clientOwnedByA: string;
let taskOwnedByA: string;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Producer Isolation Agency ${Date.now()}`);

  adminUser = await createTestUser(admin, { agencyId, role: "admin", fullName: "Agency Admin" });
  producerA = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer A" });
  producerB = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer B" });

  const { data: client, error: clientError } = await producerA.client
    .from("clients")
    .insert({ agency_id: agencyId, first_name: "Owned", last_name: "ByA" })
    .select("id")
    .single();
  if (clientError) throw clientError;
  clientOwnedByA = (client as { id: string }).id;

  const { data: task, error: taskError } = await producerA.client
    .from("tasks")
    .insert({
      agency_id: agencyId,
      title: "Follow up",
      due_date: new Date().toISOString().slice(0, 10),
      client_id: clientOwnedByA,
    })
    .select("id")
    .single();
  if (taskError) throw taskError;
  taskOwnedByA = (task as { id: string }).id;
});

afterAll(async () => {
  await deleteTestUser(admin, adminUser.userId);
  await deleteTestUser(admin, producerA.userId);
  await deleteTestUser(admin, producerB.userId);
  await deleteTestAgency(admin, agencyId);
});

describe("producer isolation (same agency)", () => {
  it("a client insert with no explicit producer defaults to the creating producer", async () => {
    const { data, error } = await admin.from("clients").select("assigned_producer_id").eq("id", clientOwnedByA).single();
    expect(error).toBeNull();
    expect((data as { assigned_producer_id: string }).assigned_producer_id).toBe(producerA.userId);
  });

  it("Producer B cannot see Producer A's client", async () => {
    const { data, error } = await producerB.client.from("clients").select("id").eq("id", clientOwnedByA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Producer B cannot see Producer A's task", async () => {
    const { data, error } = await producerB.client.from("tasks").select("id").eq("id", taskOwnedByA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Producer A can see their own client and task", async () => {
    const { data: clientRows } = await producerA.client.from("clients").select("id").eq("id", clientOwnedByA);
    expect(clientRows).toHaveLength(1);

    const { data: taskRows } = await producerA.client.from("tasks").select("id").eq("id", taskOwnedByA);
    expect(taskRows).toHaveLength(1);
  });

  it("the admin can see both producers' rows", async () => {
    const { data } = await adminUser.client.from("clients").select("id").eq("id", clientOwnedByA);
    expect(data).toHaveLength(1);
  });

  it("Producer B cannot reassign Producer A's client to themselves", async () => {
    const { error } = await producerB.client
      .from("clients")
      .update({ assigned_producer_id: producerB.userId })
      .eq("id", clientOwnedByA);
    // Blocked before the reassignment trigger even runs — RLS's UPDATE
    // USING clause already hides this row from Producer B.
    expect(error).toBeNull(); // zero-row update, not a thrown error

    const { data: unchanged } = await admin
      .from("clients")
      .select("assigned_producer_id")
      .eq("id", clientOwnedByA)
      .single();
    expect((unchanged as { assigned_producer_id: string }).assigned_producer_id).toBe(producerA.userId);
  });

  it("Producer A cannot reassign their own client to Producer B (self-service reassignment is admin-only)", async () => {
    const { error } = await producerA.client
      .from("clients")
      .update({ assigned_producer_id: producerB.userId })
      .eq("id", clientOwnedByA);
    expect(error).not.toBeNull();

    const { data: unchanged } = await admin
      .from("clients")
      .select("assigned_producer_id")
      .eq("id", clientOwnedByA)
      .single();
    expect((unchanged as { assigned_producer_id: string }).assigned_producer_id).toBe(producerA.userId);
  });

  it("the admin can reassign a client to a different producer", async () => {
    const { error } = await adminUser.client
      .from("clients")
      .update({ assigned_producer_id: producerB.userId })
      .eq("id", clientOwnedByA);
    expect(error).toBeNull();

    const { data: reassigned } = await admin
      .from("clients")
      .select("assigned_producer_id")
      .eq("id", clientOwnedByA)
      .single();
    expect((reassigned as { assigned_producer_id: string }).assigned_producer_id).toBe(producerB.userId);

    // put it back for any later test in this file
    await admin.from("clients").update({ assigned_producer_id: producerA.userId }).eq("id", clientOwnedByA);
  });

  it("a producer cannot escalate their own role to admin", async () => {
    const { error } = await producerB.client.from("profiles").update({ role: "admin" }).eq("id", producerB.userId);
    expect(error).not.toBeNull();

    const { data: unchanged } = await admin.from("profiles").select("role").eq("id", producerB.userId).single();
    expect((unchanged as { role: string }).role).toBe("producer");
  });

  it("only the admin can change another user's role", async () => {
    const { error } = await adminUser.client.from("profiles").update({ role: "admin" }).eq("id", producerB.userId);
    expect(error).toBeNull();

    const { data: promoted } = await admin.from("profiles").select("role").eq("id", producerB.userId).single();
    expect((promoted as { role: string }).role).toBe("admin");

    // revert
    await admin.from("profiles").update({ role: "producer" }).eq("id", producerB.userId);
  });
});
