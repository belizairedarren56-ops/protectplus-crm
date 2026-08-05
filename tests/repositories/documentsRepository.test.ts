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
import { createDocumentsRepository } from "@/lib/repositories/documentsRepository";

// Mirrors clientsRepository.test.ts's structure: ownership/ is_demo
// hardening proven through the actual factory-produced repository, not
// just raw SQL (Phase 2's RLS suite already covers the raw-SQL layer).

const admin = serviceClient();

let agencyId: string;
let otherAgencyId: string;
let producerA: TestUser;
let producerB: TestUser;
let adminUser: TestUser;
let otherAgencyAdmin: TestUser;
let clientOwnedByA: string;
let clientOwnedByB: string;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Documents Test Agency ${Date.now()}`);
  otherAgencyId = await createTestAgency(admin, `Documents Other Agency ${Date.now()}`);

  producerA = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer A" });
  producerB = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer B" });
  adminUser = await createTestUser(admin, { agencyId, role: "admin", fullName: "Agency Admin" });
  otherAgencyAdmin = await createTestUser(admin, {
    agencyId: otherAgencyId,
    role: "admin",
    fullName: "Other Agency Admin",
  });

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
  await deleteTestUser(admin, otherAgencyAdmin?.userId);
  await deleteTestAgency(admin, agencyId);
  await deleteTestAgency(admin, otherAgencyId);
});

describe("createDocumentsRepository — ownership through the real repository", () => {
  it("a producer can create and list a document for a client they own", async () => {
    const repoA = createDocumentsRepository(producerA.client, agencyId);
    const created = await repoA.create({
      name: "app.pdf",
      folder: "Applications",
      fileType: "pdf",
      clientId: clientOwnedByA,
    });
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.data.clientName).toContain("ByA");
  });

  it("a producer cannot create a document for another producer's client", async () => {
    const repoA = createDocumentsRepository(producerA.client, agencyId);
    const result = await repoA.create({
      name: "sneaky.pdf",
      folder: "Applications",
      fileType: "pdf",
      clientId: clientOwnedByB,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("any agency member can create and see an agency-level document (no clientId)", async () => {
    const repoA = createDocumentsRepository(producerA.client, agencyId);
    const repoB = createDocumentsRepository(producerB.client, agencyId);

    const created = await repoA.create({ name: "agency-wide.pdf", folder: "Applications", fileType: "pdf" });
    expect(created.ok).toBe(true);

    const listB = await repoB.list();
    expect(listB.ok && listB.data.some((d) => d.name === "agency-wide.pdf")).toBe(true);
  });

  it("update and delete round-trip for a document on an owned client", async () => {
    const repoA = createDocumentsRepository(producerA.client, agencyId);
    const created = await repoA.create({
      name: "update-me.pdf",
      folder: "Applications",
      fileType: "pdf",
      clientId: clientOwnedByA,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await repoA.update(created.data.id, { name: "updated.pdf" });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.data.name).toBe("updated.pdf");

    const deleted = await repoA.delete(created.data.id);
    expect(deleted.ok).toBe(true);

    const list = await repoA.list();
    expect(list.ok && list.data.some((d) => d.id === created.data.id)).toBe(false);
  });
});

describe("is_demo hardening — documents (six-point matrix)", () => {
  it("(1) rejects a non-admin's direct INSERT with is_demo = true", async () => {
    const { error } = await producerA.client.from("documents").insert({
      agency_id: agencyId,
      name: "sneaky-demo.pdf",
      folder: "Applications",
      is_demo: true,
    });
    expect(error).not.toBeNull();
  });

  it("(2) rejects a non-admin flipping an ordinary document's is_demo false -> true", async () => {
    const repoA = createDocumentsRepository(producerA.client, agencyId);
    const created = await repoA.create({ name: "ordinary.pdf", folder: "Applications", fileType: "pdf" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoA.update(created.data.id, { isDemo: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");

    const stillOrdinary = await repoA.list();
    const row = stillOrdinary.ok ? stillOrdinary.data.find((d) => d.id === created.data.id) : undefined;
    expect(row?.isDemo).toBe(false);
  });

  it("(3) rejects a non-admin flipping a demo document's is_demo true -> false", async () => {
    const repoAdmin = createDocumentsRepository(adminUser.client, agencyId);
    const repoA = createDocumentsRepository(producerA.client, agencyId);

    const batch = await repoAdmin.createDemoBatch([{ name: "demo.pdf", folder: "Applications", fileType: "pdf" }]);
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;
    const demoId = batch.data[0].id;

    const result = await repoA.update(demoId, { isDemo: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");

    await repoAdmin.clearAgencyDemoDocuments();
  });

  it("(4) clear_agency_demo_documents() rejects a non-admin caller outright", async () => {
    const repoA = createDocumentsRepository(producerA.client, agencyId);
    const result = await repoA.clearAgencyDemoDocuments();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("(5) admin clear returns the correct deleted count and never removes a non-demo row", async () => {
    const repoAdmin = createDocumentsRepository(adminUser.client, agencyId);

    const real = await repoAdmin.create({ name: "real.pdf", folder: "Applications", fileType: "pdf" });
    expect(real.ok).toBe(true);

    const batch = await repoAdmin.createDemoBatch([
      { name: "demo-a.pdf", folder: "Applications", fileType: "pdf" },
      { name: "demo-b.pdf", folder: "Applications", fileType: "pdf" },
    ]);
    expect(batch.ok).toBe(true);

    const cleared = await repoAdmin.clearAgencyDemoDocuments();
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.data.deletedCount).toBeGreaterThanOrEqual(2);

    const list = await repoAdmin.list();
    expect(list.ok && list.data.some((d) => d.name === "real.pdf")).toBe(true);
    expect(list.ok && list.data.some((d) => d.name === "demo-a.pdf")).toBe(false);
  });

  it("(6) cross-agency isolation: an admin's clear never touches another agency's demo documents", async () => {
    const repoAdminA = createDocumentsRepository(adminUser.client, agencyId);
    const repoAdminOther = createDocumentsRepository(otherAgencyAdmin.client, otherAgencyId);

    const demoOther = await repoAdminOther.createDemoBatch([
      { name: "other-agency-demo.pdf", folder: "Applications", fileType: "pdf" },
    ]);
    expect(demoOther.ok).toBe(true);

    await repoAdminA.clearAgencyDemoDocuments();

    const stillThere = await repoAdminOther.list();
    expect(stillThere.ok && stillThere.data.some((d) => d.name === "other-agency-demo.pdf")).toBe(true);

    await repoAdminOther.clearAgencyDemoDocuments();
  });
});
