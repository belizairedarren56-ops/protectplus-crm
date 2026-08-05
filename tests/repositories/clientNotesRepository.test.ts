import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestAgency,
  createTestUser,
  deleteTestAgency,
  deleteTestUser,
  serviceClient,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  type TestUser,
} from "../rls/helpers";
import { createClientsRepository } from "@/lib/repositories/clientsRepository";
import { createClientNotesRepository } from "@/lib/repositories/clientNotesRepository";

// Proves upsert_client_profile_note()'s SECURITY DEFINER hardening through
// the actual repository code, mirroring clientsRepository.test.ts's
// through-the-real-code approach for clear_agency_demo_clients().

const admin = serviceClient();

let agencyId: string;
let otherAgencyId: string;
let producerA: TestUser;
let producerB: TestUser;
let adminUser: TestUser;
let otherAgencyProducer: TestUser;

let clientOwnedByA: string;
let clientOwnedByB: string;
let clientInOtherAgency: string;

async function createClient_(owner: TestUser, agency: string, lastName: string): Promise<string> {
  const repo = createClientsRepository(owner.client, agency);
  const created = await repo.create({
    firstName: "Owned",
    lastName,
    phone: "",
    email: "",
    policyType: "Auto",
    status: "New Lead",
  });
  if (!created.ok) throw new Error(`fixture setup failed: client "${lastName}"`);
  return created.data.id;
}

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Client Notes Test Agency ${Date.now()}`);
  otherAgencyId = await createTestAgency(admin, `Client Notes Other Agency ${Date.now()}`);

  producerA = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer A" });
  producerB = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer B" });
  adminUser = await createTestUser(admin, { agencyId, role: "admin", fullName: "Agency Admin" });
  otherAgencyProducer = await createTestUser(admin, {
    agencyId: otherAgencyId,
    role: "producer",
    fullName: "Other Agency Producer",
  });

  clientOwnedByA = await createClient_(producerA, agencyId, "ByA");
  clientOwnedByB = await createClient_(producerB, agencyId, "ByB");
  clientInOtherAgency = await createClient_(otherAgencyProducer, otherAgencyId, "InOtherAgency");
});

afterAll(async () => {
  await deleteTestUser(admin, producerA?.userId);
  await deleteTestUser(admin, producerB?.userId);
  await deleteTestUser(admin, adminUser?.userId);
  await deleteTestUser(admin, otherAgencyProducer?.userId);
  await deleteTestAgency(admin, agencyId);
  await deleteTestAgency(admin, otherAgencyId);
});

describe("upsert_client_profile_note() — SECURITY DEFINER hardening", () => {
  it("rejects an unauthenticated (anon) caller", async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await anonClient.rpc("upsert_client_profile_note", {
      p_client_id: clientOwnedByA,
      p_body: "should never be written",
    });
    expect(error).not.toBeNull();
  });

  it("lets a producer save a profile note for a client they own", async () => {
    const repo = createClientNotesRepository(producerA.client);
    const saved = await repo.saveProfileNote(clientOwnedByA, "Producer A's note");
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.data).toBe("Producer A's note");

    const read = await repo.getProfileNote(clientOwnedByA);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.data).toBe("Producer A's note");
  });

  it("rejects a producer saving a note for another producer's inaccessible client", async () => {
    const repo = createClientNotesRepository(producerA.client);
    const result = await repo.saveProfileNote(clientOwnedByB, "Should be rejected");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("rejects cross-agency access even for an otherwise-valid producer", async () => {
    const repo = createClientNotesRepository(producerA.client);
    const result = await repo.saveProfileNote(clientInOtherAgency, "Should be rejected");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("restricts an admin to their own agency — cannot write a note for another agency's client", async () => {
    const repo = createClientNotesRepository(adminUser.client);
    const result = await repo.saveProfileNote(clientInOtherAgency, "Should be rejected");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("stamps created_by/updated_by from the authenticated caller, not the function owner", async () => {
    const dedicatedClientId = await createClient_(producerA, agencyId, "ForStampTest");

    const repoA = createClientNotesRepository(producerA.client);
    const inserted = await repoA.saveProfileNote(dedicatedClientId, "First save by producer A");
    expect(inserted.ok).toBe(true);

    const { data: afterInsert, error: insertReadError } = await admin
      .from("client_notes")
      .select("created_by, updated_by")
      .eq("client_id", dedicatedClientId)
      .eq("note_type", "profile")
      .single();
    expect(insertReadError).toBeNull();
    expect((afterInsert as { created_by: string }).created_by).toBe(producerA.userId);
    expect((afterInsert as { updated_by: string }).updated_by).toBe(producerA.userId);

    // A second write, by the admin (owns_or_admin lets them), goes through
    // the ON CONFLICT ... DO UPDATE branch — created_by must stay pinned to
    // whoever originally created the row, only updated_by should move.
    const repoAdmin = createClientNotesRepository(adminUser.client);
    const updated = await repoAdmin.saveProfileNote(dedicatedClientId, "Updated by admin");
    expect(updated.ok).toBe(true);

    const { data: afterUpdate, error: updateReadError } = await admin
      .from("client_notes")
      .select("created_by, updated_by, body")
      .eq("client_id", dedicatedClientId)
      .eq("note_type", "profile")
      .single();
    expect(updateReadError).toBeNull();
    expect((afterUpdate as { body: string }).body).toBe("Updated by admin");
    expect((afterUpdate as { created_by: string }).created_by).toBe(producerA.userId);
    expect((afterUpdate as { updated_by: string }).updated_by).toBe(adminUser.userId);
  });

  it("upserts in place — saving twice for the same client never creates a second row", async () => {
    const dedicatedClientId = await createClient_(producerA, agencyId, "ForUpsertTest");
    const repo = createClientNotesRepository(producerA.client);

    await repo.saveProfileNote(dedicatedClientId, "First body");
    await repo.saveProfileNote(dedicatedClientId, "Second body");

    const { data, error } = await admin
      .from("client_notes")
      .select("id, body")
      .eq("client_id", dedicatedClientId)
      .eq("note_type", "profile");
    expect(error).toBeNull();
    expect((data as { id: string; body: string }[]).length).toBe(1);
    expect((data as { id: string; body: string }[])[0].body).toBe("Second body");
  });
});
