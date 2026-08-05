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
import { createQuotesRepository } from "@/lib/repositories/quotesRepository";

// Mirrors tasksRepository.test.ts's structure: ownership/reassignment/
// is_demo hardening proven through the actual factory-produced repository.
// quotes.client_id is NOT NULL (unlike tasks' nullable client_id), so every
// fixture quote here is created against a real client.

const admin = serviceClient();

let agencyId: string;
let otherAgencyId: string;
let producerA: TestUser;
let producerB: TestUser;
let adminUser: TestUser;
let otherAgencyAdmin: TestUser;
let clientId: string;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Quotes Test Agency ${Date.now()}`);
  otherAgencyId = await createTestAgency(admin, `Quotes Other Agency ${Date.now()}`);

  producerA = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer A" });
  producerB = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer B" });
  adminUser = await createTestUser(admin, { agencyId, role: "admin", fullName: "Agency Admin" });
  otherAgencyAdmin = await createTestUser(admin, {
    agencyId: otherAgencyId,
    role: "admin",
    fullName: "Other Agency Admin",
  });

  const clientsRepo = createClientsRepository(adminUser.client, agencyId);
  const client = await clientsRepo.create({
    firstName: "Jane",
    lastName: "Cooper",
    phone: "",
    email: "",
    policyType: "Auto",
    status: "New Lead",
  });
  if (!client.ok) throw new Error("fixture setup failed: client");
  clientId = client.data.id;
});

afterAll(async () => {
  await deleteTestUser(admin, producerA?.userId);
  await deleteTestUser(admin, producerB?.userId);
  await deleteTestUser(admin, adminUser?.userId);
  await deleteTestUser(admin, otherAgencyAdmin?.userId);
  await deleteTestAgency(admin, agencyId);
  await deleteTestAgency(admin, otherAgencyId);
});

function baseInput() {
  return {
    clientId,
    clientName: "Jane Cooper",
    carrier: "State Farm",
    premium: 1000,
    insuranceType: "Auto" as const,
    status: "Draft" as const,
  };
}

describe("createQuotesRepository — ownership and reassignment through the real repository", () => {
  it("a producer's create() defaults producer_id to themselves when omitted", async () => {
    const repoA = createQuotesRepository(producerA.client, agencyId);
    const result = await repoA.create(baseInput());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerA.userId);
  });

  it("a producer only lists their own quotes; an admin lists everyone's", async () => {
    const repoA = createQuotesRepository(producerA.client, agencyId);
    const repoB = createQuotesRepository(producerB.client, agencyId);
    const repoAdmin = createQuotesRepository(adminUser.client, agencyId);

    await repoA.create({ ...baseInput(), carrier: "Visible to A" });
    await repoB.create({ ...baseInput(), carrier: "Visible to B" });

    const listA = await repoA.list();
    const listAdmin = await repoAdmin.list();

    expect(listA.ok && listA.data.some((q) => q.carrier === "Visible to B")).toBe(false);
    expect(listAdmin.ok && listAdmin.data.some((q) => q.carrier === "Visible to A")).toBe(true);
    expect(listAdmin.ok && listAdmin.data.some((q) => q.carrier === "Visible to B")).toBe(true);
  });

  it("a producer cannot assign a new quote to a different producer", async () => {
    const repoA = createQuotesRepository(producerA.client, agencyId);
    const result = await repoA.create({ ...baseInput(), assignedProducerId: producerB.userId });

    // force_owner_quotes() unconditionally overwrites producer_id for a
    // non-admin caller — this succeeds but lands on the caller, never the
    // requested target.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerA.userId);
  });

  it("an admin can create a quote explicitly assigned to a specific producer", async () => {
    const repoAdmin = createQuotesRepository(adminUser.client, agencyId);
    const result = await repoAdmin.create({ ...baseInput(), assignedProducerId: producerB.userId });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerB.userId);
  });

  it("an admin's create() fails with a typed error, not a thrown exception, when assignedProducerId is omitted", async () => {
    // producer_id is NOT NULL with no server-side default for an admin
    // caller (force_owner_quotes() only forces it for non-admins) — the UI
    // (QuoteModal) always supplies a real id for an admin, but the
    // repository itself must still degrade to a typed Result.
    const repoAdmin = createQuotesRepository(adminUser.client, agencyId);
    const result = await repoAdmin.create(baseInput());
    expect(result.ok).toBe(false);
  });

  it("a producer cannot reassign their own existing quote to another producer", async () => {
    const repoA = createQuotesRepository(producerA.client, agencyId);
    const created = await repoA.create(baseInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoA.update(created.data.id, { assignedProducerId: producerB.userId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("an admin can reassign an existing quote to a different producer", async () => {
    const repoAdmin = createQuotesRepository(adminUser.client, agencyId);
    const created = await repoAdmin.create({ ...baseInput(), assignedProducerId: producerA.userId });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoAdmin.update(created.data.id, { assignedProducerId: producerB.userId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerB.userId);
  });

  it("delete is admin-only, matching quotes_delete's RLS policy", async () => {
    const repoA = createQuotesRepository(producerA.client, agencyId);
    const repoAdmin = createQuotesRepository(adminUser.client, agencyId);
    const created = await repoA.create(baseInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deniedDelete = await repoA.delete(created.data.id);
    // RLS silently affects zero rows for a caller the delete policy
    // excludes entirely (quotes_delete requires is_admin()) — PostgREST
    // reports this as success with no error, not a denial, so this proves
    // the row survives rather than asserting an error kind.
    void deniedDelete;
    const stillThere = await repoAdmin.list();
    expect(stillThere.ok && stillThere.data.some((q) => q.id === created.data.id)).toBe(true);

    const adminDelete = await repoAdmin.delete(created.data.id);
    expect(adminDelete.ok).toBe(true);
    const gone = await repoAdmin.list();
    expect(gone.ok && gone.data.some((q) => q.id === created.data.id)).toBe(false);
  });
});

describe("is_demo hardening — quotes (six-point matrix)", () => {
  it("(1) rejects a non-admin's direct INSERT with is_demo = true", async () => {
    const { error } = await producerA.client.from("quotes").insert({
      agency_id: agencyId,
      client_id: clientId,
      client_name: "Jane Cooper",
      carrier: "sneaky-demo",
      premium: 100,
      insurance_type: "Auto",
      is_demo: true,
    });
    expect(error).not.toBeNull();
  });

  it("(2) rejects a non-admin flipping an ordinary quote's is_demo false -> true", async () => {
    const repoA = createQuotesRepository(producerA.client, agencyId);
    const created = await repoA.create(baseInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoA.update(created.data.id, { isDemo: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("(3) rejects a non-admin flipping a demo quote's is_demo true -> false", async () => {
    const repoAdmin = createQuotesRepository(adminUser.client, agencyId);
    const repoA = createQuotesRepository(producerA.client, agencyId);

    const batch = await repoAdmin.createDemoBatch([{ ...baseInput(), assignedProducerId: producerA.userId }]);
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;

    const result = await repoA.update(batch.data[0].id, { isDemo: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");

    await repoAdmin.clearAgencyDemoQuotes();
  });

  it("(4) clear_agency_demo_quotes() rejects a non-admin caller outright", async () => {
    const repoA = createQuotesRepository(producerA.client, agencyId);
    const result = await repoA.clearAgencyDemoQuotes();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("(5) admin clear returns the correct deleted count and never removes a non-demo row", async () => {
    const repoAdmin = createQuotesRepository(adminUser.client, agencyId);

    const real = await repoAdmin.create({ ...baseInput(), carrier: "Real", assignedProducerId: adminUser.userId });
    expect(real.ok).toBe(true);

    const batch = await repoAdmin.createDemoBatch([
      { ...baseInput(), carrier: "Demo A", assignedProducerId: adminUser.userId },
      { ...baseInput(), carrier: "Demo B", assignedProducerId: adminUser.userId },
    ]);
    expect(batch.ok).toBe(true);

    const cleared = await repoAdmin.clearAgencyDemoQuotes();
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.data.deletedCount).toBeGreaterThanOrEqual(2);

    const list = await repoAdmin.list();
    expect(list.ok && list.data.some((q) => q.carrier === "Real")).toBe(true);
    expect(list.ok && list.data.some((q) => q.carrier === "Demo A")).toBe(false);
  });

  it("(6) cross-agency isolation: an admin's clear never touches another agency's demo quotes", async () => {
    const repoAdminA = createQuotesRepository(adminUser.client, agencyId);
    const repoAdminOther = createQuotesRepository(otherAgencyAdmin.client, otherAgencyId);
    const clientsRepoOther = createClientsRepository(otherAgencyAdmin.client, otherAgencyId);

    const otherClient = await clientsRepoOther.create({
      firstName: "Other",
      lastName: "AgencyClient",
      phone: "",
      email: "",
      policyType: "Auto",
      status: "New Lead",
    });
    expect(otherClient.ok).toBe(true);
    if (!otherClient.ok) return;

    const demoOther = await repoAdminOther.createDemoBatch([
      {
        clientId: otherClient.data.id,
        clientName: "Other AgencyClient",
        carrier: "Other agency demo",
        premium: 500,
        insuranceType: "Auto",
        status: "Draft",
        assignedProducerId: otherAgencyAdmin.userId,
      },
    ]);
    expect(demoOther.ok).toBe(true);

    await repoAdminA.clearAgencyDemoQuotes();

    const stillThere = await repoAdminOther.list();
    expect(stillThere.ok && stillThere.data.some((q) => q.carrier === "Other agency demo")).toBe(true);

    await repoAdminOther.clearAgencyDemoQuotes();
  });
});
