import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestAgency, createTestUser, deleteTestAgency, deleteTestUser, serviceClient, type TestUser } from "./helpers";

// family_members/client_notes/documents have no owner column of their own —
// visibility and mutation rights are entirely mediated by the parent
// client's assigned_producer_id. This proves a producer can't launder that
// by *changing* client_id mid-update to point at a client they don't own
// (the UPDATE WITH CHECK gap this migration closed — see
// 20260801000006_strengthen_reparenting_checks.sql).

const admin = serviceClient();

let agencyId: string;
let producerA: TestUser;
let producerB: TestUser;
let adminUser: TestUser;
let clientOwnedByA: string;
let clientOwnedByB: string;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Reparenting Agency ${Date.now()}`);
  producerA = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer A" });
  producerB = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer B" });
  adminUser = await createTestUser(admin, { agencyId, role: "admin", fullName: "Agency Admin" });

  const { data: cA, error: cAError } = await producerA.client
    .from("clients")
    .insert({ agency_id: agencyId, first_name: "Owned", last_name: "ByA" })
    .select("id")
    .single();
  if (cAError) throw cAError;
  clientOwnedByA = (cA as { id: string }).id;

  const { data: cB, error: cBError } = await producerB.client
    .from("clients")
    .insert({ agency_id: agencyId, first_name: "Owned", last_name: "ByB" })
    .select("id")
    .single();
  if (cBError) throw cBError;
  clientOwnedByB = (cB as { id: string }).id;
});

afterAll(async () => {
  await deleteTestUser(admin, producerA.userId);
  await deleteTestUser(admin, producerB.userId);
  await deleteTestUser(admin, adminUser.userId);
  await deleteTestAgency(admin, agencyId);
});

describe("reparenting family_members/client_notes/documents is blocked cross-owner", () => {
  it("Producer A cannot move a family member from their own client onto Producer B's client", async () => {
    const { data: member, error: createError } = await producerA.client
      .from("family_members")
      .insert({ agency_id: agencyId, client_id: clientOwnedByA, name: "Sam", relationship: "Spouse" })
      .select("id")
      .single();
    if (createError) throw createError;
    const memberId = (member as { id: string }).id;

    const { error: updateError } = await producerA.client
      .from("family_members")
      .update({ client_id: clientOwnedByB })
      .eq("id", memberId);
    // RLS UPDATE ... WITH CHECK rejects the resulting row outright (not a
    // silent zero-row filter, since the row *was* visible/matched by USING).
    expect(updateError).not.toBeNull();

    const { data: unchanged } = await admin.from("family_members").select("client_id").eq("id", memberId).single();
    expect((unchanged as { client_id: string }).client_id).toBe(clientOwnedByA);
  });

  it("Producer A cannot move a client note from their own client onto Producer B's client", async () => {
    const { data: note, error: createError } = await producerA.client
      .from("client_notes")
      .insert({ agency_id: agencyId, client_id: clientOwnedByA, body: "Follow up next week" })
      .select("id")
      .single();
    if (createError) throw createError;
    const noteId = (note as { id: string }).id;

    const { error: updateError } = await producerA.client
      .from("client_notes")
      .update({ client_id: clientOwnedByB })
      .eq("id", noteId);
    expect(updateError).not.toBeNull();

    const { data: unchanged } = await admin.from("client_notes").select("client_id").eq("id", noteId).single();
    expect((unchanged as { client_id: string }).client_id).toBe(clientOwnedByA);
  });

  it("Producer A cannot move a document from their own client onto Producer B's client", async () => {
    const { data: doc, error: createError } = await producerA.client
      .from("documents")
      .insert({ agency_id: agencyId, client_id: clientOwnedByA, folder: "Applications", name: "app.pdf" })
      .select("id")
      .single();
    if (createError) throw createError;
    const docId = (doc as { id: string }).id;

    const { error: updateError } = await producerA.client
      .from("documents")
      .update({ client_id: clientOwnedByB })
      .eq("id", docId);
    expect(updateError).not.toBeNull();

    const { data: unchanged } = await admin.from("documents").select("client_id").eq("id", docId).single();
    expect((unchanged as { client_id: string }).client_id).toBe(clientOwnedByA);
  });

  it("Producer A can still update a non-ownership field on their own family member", async () => {
    const { data: member, error: createError } = await producerA.client
      .from("family_members")
      .insert({ agency_id: agencyId, client_id: clientOwnedByA, name: "Original Name", relationship: "Child" })
      .select("id")
      .single();
    if (createError) throw createError;
    const memberId = (member as { id: string }).id;

    const { error: updateError } = await producerA.client
      .from("family_members")
      .update({ name: "Updated Name" })
      .eq("id", memberId);
    expect(updateError).toBeNull();

    const { data: updated } = await admin.from("family_members").select("name").eq("id", memberId).single();
    expect((updated as { name: string }).name).toBe("Updated Name");
  });

  it("an admin can reparent a document across producers (full agency access is intentional)", async () => {
    const { data: doc, error: createError } = await producerA.client
      .from("documents")
      .insert({ agency_id: agencyId, client_id: clientOwnedByA, folder: "Declarations", name: "dec.pdf" })
      .select("id")
      .single();
    if (createError) throw createError;
    const docId = (doc as { id: string }).id;

    const { error: updateError } = await adminUser.client
      .from("documents")
      .update({ client_id: clientOwnedByB })
      .eq("id", docId);
    expect(updateError).toBeNull();

    const { data: reparented } = await admin.from("documents").select("client_id").eq("id", docId).single();
    expect((reparented as { client_id: string }).client_id).toBe(clientOwnedByB);
  });
});
