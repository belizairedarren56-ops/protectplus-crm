import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestAgency,
  createTestUser,
  deleteTestAgency,
  deleteTestUser,
  serviceClient,
  type TestUser,
} from "../rls/helpers";
import { createClientsRepository } from "@/lib/repositories/clientsRepository";

// Re-proves agency/producer isolation and the demo-clearing RPC's
// guarantees THROUGH the actual factory-produced repository code (not just
// raw SQL, as Phase 2's RLS suite already does) — catching a bug a
// .select() typo or a wrong RPC name could introduce even with correct RLS.

const admin = serviceClient();

let agencyId: string;
let producerA: TestUser;
let producerB: TestUser;
let adminUser: TestUser;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Repo Test Agency ${Date.now()}`);
  producerA = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer A" });
  producerB = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer B" });
  adminUser = await createTestUser(admin, { agencyId, role: "admin", fullName: "Agency Admin" });
});

afterAll(async () => {
  await deleteTestUser(admin, producerA?.userId);
  await deleteTestUser(admin, producerB?.userId);
  await deleteTestUser(admin, adminUser?.userId);
  await deleteTestAgency(admin, agencyId);
});

describe("createClientsRepository — agency/producer isolation through the real repository", () => {
  it("a producer's create() defaults assigned_producer_id to themselves", async () => {
    const repoA = createClientsRepository(producerA.client, agencyId);
    const result = await repoA.create({
      firstName: "Owned",
      lastName: "ByA",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerA.userId);
  });

  it("a producer only lists their own clients; an admin lists everyone's", async () => {
    const repoA = createClientsRepository(producerA.client, agencyId);
    const repoB = createClientsRepository(producerB.client, agencyId);
    const repoAdmin = createClientsRepository(adminUser.client, agencyId);

    await repoA.create({
      firstName: "Visible",
      lastName: "ToA",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
    });
    await repoB.create({
      firstName: "Visible",
      lastName: "ToB",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
    });

    const listA = await repoA.list();
    const listB = await repoB.list();
    const listAdmin = await repoAdmin.list();

    expect(listA.ok && listA.data.some((c) => c.lastName === "ToB")).toBe(false);
    expect(listB.ok && listB.data.some((c) => c.lastName === "ToA")).toBe(false);
    expect(listAdmin.ok && listAdmin.data.some((c) => c.lastName === "ToA")).toBe(true);
    expect(listAdmin.ok && listAdmin.data.some((c) => c.lastName === "ToB")).toBe(true);
  });

  it("a producer cannot assign a new client to a different producer", async () => {
    const repoA = createClientsRepository(producerA.client, agencyId);
    const result = await repoA.create({
      firstName: "Reassign",
      lastName: "Attempt",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
      assignedProducerId: producerB.userId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("an admin can assign a new client to a specific producer", async () => {
    const repoAdmin = createClientsRepository(adminUser.client, agencyId);
    const result = await repoAdmin.create({
      firstName: "Admin",
      lastName: "Assigned",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
      assignedProducerId: producerB.userId,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerB.userId);
  });

  it("archive then restore round-trips archivedAt", async () => {
    const repoA = createClientsRepository(producerA.client, agencyId);
    const created = await repoA.create({
      firstName: "Archive",
      lastName: "Me",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const archived = await repoA.archive(created.data.id);
    expect(archived.ok).toBe(true);
    if (archived.ok) expect(archived.data.archivedAt).toBeTruthy();

    const restored = await repoA.restore(created.data.id);
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.data.archivedAt).toBeFalsy();
  });
});

describe("clear_agency_demo_clients() RPC — admin-only, never touches non-demo rows", () => {
  it("rejects a non-admin caller outright", async () => {
    const repoA = createClientsRepository(producerA.client, agencyId);
    const result = await repoA.clearAgencyDemoClients();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("never removes a non-demo row, even when called correctly by an admin", async () => {
    const repoAdmin = createClientsRepository(adminUser.client, agencyId);
    const created = await repoAdmin.create({
      firstName: "Real",
      lastName: "NotDemo",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
      isDemo: false,
    });
    expect(created.ok).toBe(true);

    const cleared = await repoAdmin.clearAgencyDemoClients();
    expect(cleared.ok).toBe(true);

    const stillThere = await repoAdmin.get(created.ok ? created.data.id : "");
    expect(stillThere.ok).toBe(true);
    if (stillThere.ok) expect(stillThere.data).not.toBeNull();
  });

  it("removes demo rows when called correctly by an admin", async () => {
    const repoAdmin = createClientsRepository(adminUser.client, agencyId);
    const batch = await repoAdmin.createDemoBatch([
      {
        firstName: "Demo",
        lastName: "Row",
        phone: "",
        email: "",
        policyType: "Auto",
        status: "New Lead",
      },
    ]);
    expect(batch.ok).toBe(true);

    const cleared = await repoAdmin.clearAgencyDemoClients();
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.data.deletedCount).toBeGreaterThanOrEqual(1);

    if (batch.ok) {
      const gone = await repoAdmin.get(batch.data[0].id);
      expect(gone.ok).toBe(true);
      if (gone.ok) expect(gone.data).toBeNull();
    }
  });
});

describe("is_demo insert restriction — non-admin cannot create a demo row", () => {
  it("rejects a producer's attempt to insert is_demo = true directly", async () => {
    const { error } = await producerA.client.from("clients").insert({
      agency_id: agencyId,
      first_name: "Sneaky",
      last_name: "Demo",
      is_demo: true,
    });

    expect(error).not.toBeNull();
  });

  it("allows an admin to insert is_demo = true directly", async () => {
    const { error } = await adminUser.client.from("clients").insert({
      agency_id: agencyId,
      first_name: "Legit",
      last_name: "Demo",
      is_demo: true,
    });

    expect(error).toBeNull();
  });
});
