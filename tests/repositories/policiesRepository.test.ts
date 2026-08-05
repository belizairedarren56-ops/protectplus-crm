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
import { createPoliciesRepository } from "@/lib/repositories/policiesRepository";

// Mirrors quotesRepository.test.ts's structure: ownership/reassignment/
// is_demo hardening proven through the actual factory-produced repository.
// policies.client_id is NOT NULL, same as quotes.

const admin = serviceClient();

let agencyId: string;
let otherAgencyId: string;
let producerA: TestUser;
let producerB: TestUser;
let adminUser: TestUser;
let otherAgencyAdmin: TestUser;
let clientId: string;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Policies Test Agency ${Date.now()}`);
  otherAgencyId = await createTestAgency(admin, `Policies Other Agency ${Date.now()}`);

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

let policyNumberCounter = 0;
function baseInput() {
  policyNumberCounter += 1;
  return {
    clientId,
    clientName: "Jane Cooper",
    carrier: "State Farm",
    policyNumber: `SF-${Date.now()}-${policyNumberCounter}`,
    product: "Auto" as const,
    effectiveDate: "2026-01-01",
    expirationDate: "2026-07-01",
    status: "Active" as const,
    premium: 1200,
  };
}

describe("createPoliciesRepository — ownership and reassignment through the real repository", () => {
  it("a producer's create() defaults producer_id to themselves when omitted", async () => {
    const repoA = createPoliciesRepository(producerA.client, agencyId);
    const result = await repoA.create(baseInput());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerA.userId);
  });

  it("a producer only lists their own policies; an admin lists everyone's", async () => {
    const repoA = createPoliciesRepository(producerA.client, agencyId);
    const repoB = createPoliciesRepository(producerB.client, agencyId);
    const repoAdmin = createPoliciesRepository(adminUser.client, agencyId);

    await repoA.create({ ...baseInput(), carrier: "Visible to A" });
    await repoB.create({ ...baseInput(), carrier: "Visible to B" });

    const listA = await repoA.list();
    const listAdmin = await repoAdmin.list();

    expect(listA.ok && listA.data.some((p) => p.carrier === "Visible to B")).toBe(false);
    expect(listAdmin.ok && listAdmin.data.some((p) => p.carrier === "Visible to A")).toBe(true);
    expect(listAdmin.ok && listAdmin.data.some((p) => p.carrier === "Visible to B")).toBe(true);
  });

  it("a producer cannot assign a new policy to a different producer", async () => {
    const repoA = createPoliciesRepository(producerA.client, agencyId);
    const result = await repoA.create({ ...baseInput(), assignedProducerId: producerB.userId });

    // force_owner_policies() unconditionally overwrites producer_id for a
    // non-admin caller — this succeeds but lands on the caller.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerA.userId);
  });

  it("an admin can create a policy explicitly assigned to a specific producer", async () => {
    const repoAdmin = createPoliciesRepository(adminUser.client, agencyId);
    const result = await repoAdmin.create({ ...baseInput(), assignedProducerId: producerB.userId });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerB.userId);
  });

  it("an admin's create() fails with a typed error, not a thrown exception, when assignedProducerId is omitted", async () => {
    // producer_id is NOT NULL with no server-side default for an admin
    // caller (force_owner_policies() only forces it for non-admins) — the
    // UI (PolicyModal) always supplies a real id for an admin, but the
    // repository itself must still degrade to a typed Result.
    const repoAdmin = createPoliciesRepository(adminUser.client, agencyId);
    const result = await repoAdmin.create(baseInput());
    expect(result.ok).toBe(false);
  });

  it("a producer cannot reassign their own existing policy to another producer", async () => {
    const repoA = createPoliciesRepository(producerA.client, agencyId);
    const created = await repoA.create(baseInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoA.update(created.data.id, { assignedProducerId: producerB.userId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("an admin can reassign an existing policy to a different producer", async () => {
    const repoAdmin = createPoliciesRepository(adminUser.client, agencyId);
    const created = await repoAdmin.create({ ...baseInput(), assignedProducerId: producerA.userId });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoAdmin.update(created.data.id, { assignedProducerId: producerB.userId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedProducerId).toBe(producerB.userId);
  });

  it("delete is admin-only, matching policies_delete's RLS policy", async () => {
    const repoA = createPoliciesRepository(producerA.client, agencyId);
    const repoAdmin = createPoliciesRepository(adminUser.client, agencyId);
    const created = await repoA.create(baseInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await repoA.delete(created.data.id);
    const stillThere = await repoAdmin.list();
    expect(stillThere.ok && stillThere.data.some((p) => p.id === created.data.id)).toBe(true);

    const adminDelete = await repoAdmin.delete(created.data.id);
    expect(adminDelete.ok).toBe(true);
    const gone = await repoAdmin.list();
    expect(gone.ok && gone.data.some((p) => p.id === created.data.id)).toBe(false);
  });

  it("rejects a duplicate policy number for the same agency and carrier, surfaced as a typed validation error", async () => {
    const repoAdmin = createPoliciesRepository(adminUser.client, agencyId);
    const input = { ...baseInput(), assignedProducerId: adminUser.userId };

    const first = await repoAdmin.create(input);
    expect(first.ok).toBe(true);

    const second = await repoAdmin.create(input);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.kind).toBe("validation");
  });
});

describe("is_demo hardening — policies (six-point matrix)", () => {
  it("(1) rejects a non-admin's direct INSERT with is_demo = true", async () => {
    const { error } = await producerA.client.from("policies").insert({
      agency_id: agencyId,
      client_id: clientId,
      client_name: "Jane Cooper",
      carrier: "sneaky-demo",
      policy_number: `SNEAKY-${Date.now()}`,
      product: "Auto",
      effective_date: "2026-01-01",
      expiration_date: "2026-07-01",
      premium: 100,
      is_demo: true,
    });
    expect(error).not.toBeNull();
  });

  it("(2) rejects a non-admin flipping an ordinary policy's is_demo false -> true", async () => {
    const repoA = createPoliciesRepository(producerA.client, agencyId);
    const created = await repoA.create(baseInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoA.update(created.data.id, { isDemo: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("(3) rejects a non-admin flipping a demo policy's is_demo true -> false", async () => {
    const repoAdmin = createPoliciesRepository(adminUser.client, agencyId);
    const repoA = createPoliciesRepository(producerA.client, agencyId);

    const batch = await repoAdmin.createDemoBatch([{ ...baseInput(), assignedProducerId: producerA.userId }]);
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;

    const result = await repoA.update(batch.data[0].id, { isDemo: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");

    await repoAdmin.clearAgencyDemoPolicies();
  });

  it("(4) clear_agency_demo_policies() rejects a non-admin caller outright", async () => {
    const repoA = createPoliciesRepository(producerA.client, agencyId);
    const result = await repoA.clearAgencyDemoPolicies();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("(5) admin clear returns the correct deleted count and never removes a non-demo row", async () => {
    const repoAdmin = createPoliciesRepository(adminUser.client, agencyId);

    const real = await repoAdmin.create({ ...baseInput(), carrier: "Real", assignedProducerId: adminUser.userId });
    expect(real.ok).toBe(true);

    const batch = await repoAdmin.createDemoBatch([
      { ...baseInput(), carrier: "Demo A", assignedProducerId: adminUser.userId },
      { ...baseInput(), carrier: "Demo B", assignedProducerId: adminUser.userId },
    ]);
    expect(batch.ok).toBe(true);

    const cleared = await repoAdmin.clearAgencyDemoPolicies();
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.data.deletedCount).toBeGreaterThanOrEqual(2);

    const list = await repoAdmin.list();
    expect(list.ok && list.data.some((p) => p.carrier === "Real")).toBe(true);
    expect(list.ok && list.data.some((p) => p.carrier === "Demo A")).toBe(false);
  });

  it("(6) cross-agency isolation: an admin's clear never touches another agency's demo policies", async () => {
    const repoAdminA = createPoliciesRepository(adminUser.client, agencyId);
    const repoAdminOther = createPoliciesRepository(otherAgencyAdmin.client, otherAgencyId);
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
        policyNumber: `OTH-${Date.now()}`,
        product: "Auto",
        effectiveDate: "2026-01-01",
        expirationDate: "2026-07-01",
        status: "Active",
        premium: 500,
        assignedProducerId: otherAgencyAdmin.userId,
      },
    ]);
    expect(demoOther.ok).toBe(true);

    await repoAdminA.clearAgencyDemoPolicies();

    const stillThere = await repoAdminOther.list();
    expect(stillThere.ok && stillThere.data.some((p) => p.carrier === "Other agency demo")).toBe(true);

    await repoAdminOther.clearAgencyDemoPolicies();
  });
});
