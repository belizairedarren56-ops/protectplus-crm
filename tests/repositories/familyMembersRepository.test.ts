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
import { createFamilyMembersRepository } from "@/lib/repositories/familyMembersRepository";

// family_members has no owner column of its own — visibility follows the
// parent client's assigned_producer_id (Phase 2's family_members_select/
// _insert/_update/_delete policies). This proves that through the actual
// factory-produced repository, not just raw SQL.

const admin = serviceClient();

let agencyId: string;
let producerA: TestUser;
let producerB: TestUser;
let adminUser: TestUser;
let clientOwnedByA: string;
let clientOwnedByB: string;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Family Members Test Agency ${Date.now()}`);
  producerA = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer A" });
  producerB = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer B" });
  adminUser = await createTestUser(admin, { agencyId, role: "admin", fullName: "Agency Admin" });

  const repoA = createClientsRepository(producerA.client, agencyId);
  const createdA = await repoA.create({
    firstName: "Owned",
    lastName: "ByA",
    phone: "",
    email: "",
    policyType: "Auto",
    status: "New Lead",
  });
  if (!createdA.ok) throw new Error("fixture setup failed: client for producer A");
  clientOwnedByA = createdA.data.id;

  const repoB = createClientsRepository(producerB.client, agencyId);
  const createdB = await repoB.create({
    firstName: "Owned",
    lastName: "ByB",
    phone: "",
    email: "",
    policyType: "Auto",
    status: "New Lead",
  });
  if (!createdB.ok) throw new Error("fixture setup failed: client for producer B");
  clientOwnedByB = createdB.data.id;
});

afterAll(async () => {
  await deleteTestUser(admin, producerA?.userId);
  await deleteTestUser(admin, producerB?.userId);
  await deleteTestUser(admin, adminUser?.userId);
  await deleteTestAgency(admin, agencyId);
});

describe("createFamilyMembersRepository — ownership follows the parent client", () => {
  it("a producer can create and list a family member for a client they own", async () => {
    const repoA = createFamilyMembersRepository(producerA.client, agencyId);
    const created = await repoA.create({ clientId: clientOwnedByA, name: "Jane Doe", relationship: "Spouse" });
    expect(created.ok).toBe(true);

    const list = await repoA.list();
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.some((m) => m.name === "Jane Doe")).toBe(true);
  });

  it("a producer cannot create a family member for another producer's client", async () => {
    const repoA = createFamilyMembersRepository(producerA.client, agencyId);
    const result = await repoA.create({ clientId: clientOwnedByB, name: "Sneaky", relationship: "Spouse" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("a producer only sees family members belonging to clients they can access; an admin sees everyone's", async () => {
    const repoA = createFamilyMembersRepository(producerA.client, agencyId);
    const repoB = createFamilyMembersRepository(producerB.client, agencyId);
    const repoAdmin = createFamilyMembersRepository(adminUser.client, agencyId);

    await repoB.create({ clientId: clientOwnedByB, name: "VisibleToB", relationship: "Child" });

    const listA = await repoA.list();
    const listAdmin = await repoAdmin.list();

    expect(listA.ok && listA.data.some((m) => m.name === "VisibleToB")).toBe(false);
    expect(listAdmin.ok && listAdmin.data.some((m) => m.name === "VisibleToB")).toBe(true);
  });

  it("update and delete round-trip for a family member on an owned client", async () => {
    const repoA = createFamilyMembersRepository(producerA.client, agencyId);
    const created = await repoA.create({ clientId: clientOwnedByA, name: "Update Me", relationship: "Parent" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await repoA.update(created.data.id, { name: "Updated Name" });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.data.name).toBe("Updated Name");

    const deleted = await repoA.delete(created.data.id);
    expect(deleted.ok).toBe(true);

    const list = await repoA.list();
    expect(list.ok && list.data.some((m) => m.id === created.data.id)).toBe(false);
  });

  it("cascades: deleting the parent client removes its family members", async () => {
    const repoAdmin = createFamilyMembersRepository(adminUser.client, agencyId);
    const clientsRepoAdmin = createClientsRepository(adminUser.client, agencyId);

    const cascadeClient = await clientsRepoAdmin.create({
      firstName: "Cascade",
      lastName: "Target",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
    });
    expect(cascadeClient.ok).toBe(true);
    if (!cascadeClient.ok) return;

    const member = await repoAdmin.create({
      clientId: cascadeClient.data.id,
      name: "Cascades Away",
      relationship: "Spouse",
    });
    expect(member.ok).toBe(true);

    await admin.from("clients").delete().eq("id", cascadeClient.data.id);

    const { data, error } = await admin.from("family_members").select("id").eq("client_id", cascadeClient.data.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
