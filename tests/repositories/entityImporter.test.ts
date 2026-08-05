import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestAgency,
  createTestUser,
  deleteTestAgency,
  deleteTestUser,
  serviceClient,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  type TestUser,
} from "../rls/helpers";
import { createClientsRepository } from "@/lib/repositories/clientsRepository";

// Two layers, matching the two things that need proving:
//  1. import_client_entities() itself — called directly via .rpc(), proving
//     the SECURITY DEFINER hardening (anon/authenticated rejection,
//     cross-table rollback, FK-level rejection of a bad mapping) that no
//     amount of script-level validation can substitute for.
//  2. scripts/migrate-client-entities-to-supabase.ts — run as a real
//     subprocess exactly as a human would, proving the two-phase script's
//     own validation and idempotency, mirroring importer.test.ts's
//     existing pattern for the clients importer.

const admin = serviceClient();

let agencyId: string;
let producer: TestUser;
let clientLegacyId: string;
let clientUuid: string;
let tmpDir: string;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Entity Importer Test Agency ${Date.now()}`);
  producer = await createTestUser(admin, { agencyId, role: "producer", fullName: "Maria Gonzalez" });
  tmpDir = mkdtempSync(join(tmpdir(), "protectplus-entity-importer-test-"));

  clientLegacyId = `legacy-client-${Date.now()}`;
  const clientsRepo = createClientsRepository(admin, agencyId);
  const created = await clientsRepo.create({
    firstName: "Imported",
    lastName: "Client",
    phone: "",
    email: "",
    policyType: "Auto",
    status: "Active",
  });
  if (!created.ok) throw new Error("fixture setup failed: client");
  clientUuid = created.data.id;

  // Give the client a legacy_id directly (bypassing the clients importer,
  // which isn't what this suite is testing) so entity records can resolve
  // against it exactly like a real post-clients-import state would.
  const { error } = await admin.from("clients").update({ legacy_id: clientLegacyId }).eq("id", clientUuid);
  if (error) throw error;
}, 30_000);

afterAll(async () => {
  await deleteTestUser(admin, producer?.userId);
  await deleteTestAgency(admin, agencyId);
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("import_client_entities() — SECURITY DEFINER hardening", () => {
  it("cannot be executed by an unauthenticated (anon) caller", async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await anonClient.rpc("import_client_entities", { p_agency_id: agencyId });
    expect(error).not.toBeNull();
  });

  it("cannot be executed by an ordinary authenticated (non-service-role) caller", async () => {
    const { error } = await producer.client.rpc("import_client_entities", { p_agency_id: agencyId });
    expect(error).not.toBeNull();
  });

  it("service_role execution rejects a nonexistent/inconsistent client mapping via the composite FK", async () => {
    const bogusClientId = "00000000-0000-0000-0000-000000000000";
    const { error } = await admin.rpc("import_client_entities", {
      p_agency_id: agencyId,
      p_policies: [
        {
          legacyId: `bad-policy-${Date.now()}`,
          clientId: bogusClientId,
          producerId: producer.userId,
          clientName: "Nobody",
          carrier: "State Farm",
          policyNumber: `SF-BOGUS-${Date.now()}`,
          product: "Auto",
          effectiveDate: "2026-01-01",
          expirationDate: "2026-07-01",
          premium: 1000,
        },
      ],
    });

    // Rejected at the database level (the composite FK on
    // policies.client_id/agency_id), independent of any script-side
    // validation — this proves the RPC's own defense in depth, not just
    // that migrate-client-entities-to-supabase.ts happens to catch it first.
    expect(error).not.toBeNull();
  });

  it("any failure rolls back all seven entity imports together, not just the failing table", async () => {
    const legacyId = `rollback-${Date.now()}`;
    const bogusClientId = "00000000-0000-0000-0000-000000000000";

    const { error } = await admin.rpc("import_client_entities", {
      p_agency_id: agencyId,
      p_policies: [
        {
          legacyId: `${legacyId}-policy`,
          clientId: clientUuid,
          producerId: producer.userId,
          clientName: "Imported Client",
          carrier: "State Farm",
          policyNumber: `SF-${legacyId}`,
          product: "Auto",
          effectiveDate: "2026-01-01",
          expirationDate: "2026-07-01",
          premium: 1000,
        },
      ],
      p_quotes: [
        {
          legacyId: `${legacyId}-quote`,
          clientId: clientUuid,
          producerId: producer.userId,
          clientName: "Imported Client",
          carrier: "State Farm",
          premium: 900,
          insuranceType: "Auto",
        },
      ],
      p_tasks: [
        {
          legacyId: `${legacyId}-task`,
          clientId: clientUuid,
          assignedTo: producer.userId,
          title: "Follow up",
          dueDate: "2026-01-01",
        },
      ],
      p_documents: [
        { legacyId: `${legacyId}-doc`, clientId: clientUuid, folder: "Applications", name: "app.pdf" },
      ],
      p_client_notes: [{ clientId: clientUuid, body: "Should not persist" }],
      p_family_members: [
        { legacyId: `${legacyId}-fam`, clientId: clientUuid, name: "Should not persist", relationship: "Spouse" },
      ],
      p_leads: [
        // The one deliberately-invalid record — an unresolvable client —
        // which must cause the ENTIRE call to fail, not just this insert.
        {
          legacyId: `${legacyId}-lead`,
          clientId: bogusClientId,
          producerId: producer.userId,
          clientName: "Nobody",
          insuranceType: "Auto",
        },
      ],
    });

    expect(error).not.toBeNull();

    const [policies, quotes, tasks, documents, notes, family, leads] = await Promise.all([
      admin.from("policies").select("id").eq("agency_id", agencyId).eq("legacy_id", `${legacyId}-policy`),
      admin.from("quotes").select("id").eq("agency_id", agencyId).eq("legacy_id", `${legacyId}-quote`),
      admin.from("tasks").select("id").eq("agency_id", agencyId).eq("legacy_id", `${legacyId}-task`),
      admin.from("documents").select("id").eq("agency_id", agencyId).eq("legacy_id", `${legacyId}-doc`),
      admin.from("client_notes").select("id").eq("agency_id", agencyId).eq("client_id", clientUuid),
      admin.from("family_members").select("id").eq("agency_id", agencyId).eq("legacy_id", `${legacyId}-fam`),
      admin.from("leads").select("id").eq("agency_id", agencyId).eq("legacy_id", `${legacyId}-lead`),
    ]);

    // Zero rows in every one of the six otherwise-valid entities, not just
    // the seventh (leads) that had the bad row — the property one atomic
    // transaction actually promises.
    expect(policies.data).toHaveLength(0);
    expect(quotes.data).toHaveLength(0);
    expect(tasks.data).toHaveLength(0);
    expect(documents.data).toHaveLength(0);
    expect(notes.data).toHaveLength(0);
    expect(family.data).toHaveLength(0);
    expect(leads.data).toHaveLength(0);
  });
});

function runImporter(fixture: unknown): { status: number; stdout: string; stderr: string } {
  const filePath = join(tmpDir, `fixture-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(filePath, JSON.stringify(fixture));

  try {
    const stdout = execFileSync(
      "npx",
      ["tsx", "scripts/migrate-client-entities-to-supabase.ts", "--file", filePath, "--agency-id", agencyId],
      {
        env: { ...process.env, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY },
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const execError = error as { status: number | null; stdout: string; stderr: string };
    return { status: execError.status ?? 1, stdout: execError.stdout, stderr: execError.stderr };
  }
}

describe("scripts/migrate-client-entities-to-supabase.ts — real subprocess against local Supabase", () => {
  it("imports all seven entities and is idempotent on a second run of the same file", async () => {
    const runId = `run-${Date.now()}`;
    const fixture = {
      policies: [
        {
          id: `${runId}-policy`,
          clientId: clientLegacyId,
          clientName: "Imported Client",
          carrier: "State Farm",
          policyNumber: `SF-${runId}`,
          product: "Auto",
          effectiveDate: "2026-01-01",
          expirationDate: "2026-07-01",
          premium: 1000,
          producer: "Maria Gonzalez",
        },
      ],
      quotes: [
        {
          id: `${runId}-quote`,
          clientId: clientLegacyId,
          clientName: "Imported Client",
          carrier: "State Farm",
          premium: 900,
          insuranceType: "Auto",
          assignedProducerName: "Maria Gonzalez",
        },
      ],
      tasks: [
        {
          id: `${runId}-task`,
          clientId: clientLegacyId,
          title: "Follow up on renewal",
          dueDate: "2026-01-01",
          assignedToName: "Maria Gonzalez",
        },
      ],
      documents: [
        { id: `${runId}-doc`, clientId: clientLegacyId, folder: "Applications", name: "app.pdf" },
      ],
      clientNotes: [{ clientId: clientLegacyId, body: "Imported note text" }],
      familyMembers: [
        { clientId: clientLegacyId, name: "Jane Imported", relationship: "Spouse" },
        { clientId: clientLegacyId, name: "Jack Imported", relationship: "Child" },
      ],
      leads: [
        {
          id: `${runId}-lead`,
          clientId: clientLegacyId,
          clientName: "Imported Client",
          insuranceType: "Auto",
          stage: "New",
          assignedProducerName: "Maria Gonzalez",
        },
      ],
    };

    const first = runImporter(fixture);
    expect(first.status).toBe(0);
    expect(first.stdout).toMatch(/policies:\s+1/);
    expect(first.stdout).toMatch(/quotes:\s+1/);
    expect(first.stdout).toMatch(/tasks:\s+1/);
    expect(first.stdout).toMatch(/documents:\s+1/);
    expect(first.stdout).toMatch(/clientNotes:\s+1/);
    expect(first.stdout).toMatch(/familyMembers:\s+2/);
    expect(first.stdout).toMatch(/leads:\s+1/);

    const { data: policyRows } = await admin
      .from("policies")
      .select("id, producer_id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", `${runId}-policy`);
    expect(policyRows).toHaveLength(1);
    expect((policyRows as { producer_id: string }[])[0].producer_id).toBe(producer.userId);

    const { data: leadRows } = await admin
      .from("leads")
      .select("id, producer_id, client_id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", `${runId}-lead`);
    expect(leadRows).toHaveLength(1);
    expect((leadRows as { producer_id: string; client_id: string }[])[0].producer_id).toBe(producer.userId);
    expect((leadRows as { producer_id: string; client_id: string }[])[0].client_id).toBe(clientUuid);

    // Re-running against the SAME file must insert zero NEW policy/quote/
    // task/document/family-member/lead rows (legacy_id-keyed idempotency),
    // and must not create a second client_notes row (upsert-in-place instead).
    const second = runImporter(fixture);
    expect(second.status).toBe(0);
    expect(second.stdout).toMatch(/policies:\s+0/);
    expect(second.stdout).toMatch(/quotes:\s+0/);
    expect(second.stdout).toMatch(/tasks:\s+0/);
    expect(second.stdout).toMatch(/documents:\s+0/);
    expect(second.stdout).toMatch(/familyMembers:\s+0/);
    expect(second.stdout).toMatch(/leads:\s+0/);

    const { data: policyRowsAfterRerun } = await admin
      .from("policies")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", `${runId}-policy`);
    expect(policyRowsAfterRerun).toHaveLength(1); // still exactly one, not two

    const { data: leadRowsAfterRerun } = await admin
      .from("leads")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", `${runId}-lead`);
    expect(leadRowsAfterRerun).toHaveLength(1); // still exactly one, not two

    const { data: noteRows } = await admin
      .from("client_notes")
      .select("id, body")
      .eq("agency_id", agencyId)
      .eq("client_id", clientUuid)
      .eq("note_type", "profile");
    expect(noteRows).toHaveLength(1);
    expect((noteRows as { body: string }[])[0].body).toBe("Imported note text");
  }, 60_000);

  it("is all-or-nothing at the script level: an unresolvable clientId blocks the entire batch", async () => {
    const runId = `bad-run-${Date.now()}`;
    const fixture = {
      policies: [
        {
          id: `${runId}-policy`,
          clientId: clientLegacyId,
          clientName: "Imported Client",
          carrier: "State Farm",
          policyNumber: `SF-${runId}`,
          product: "Auto",
          effectiveDate: "2026-01-01",
          expirationDate: "2026-07-01",
          premium: 1000,
          producer: "Maria Gonzalez",
        },
      ],
      documents: [
        {
          id: `${runId}-doc`,
          clientId: "no-such-legacy-client-id",
          folder: "Applications",
          name: "app.pdf",
        },
      ],
    };

    const result = runImporter(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/failed validation/i);

    // Not even the row with a valid clientId was written — Phase A
    // validates every record across every entity before Phase B (the RPC
    // call) ever runs.
    const { data } = await admin
      .from("policies")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", `${runId}-policy`);
    expect(data).toHaveLength(0);
  }, 60_000);

  it("rejects a task with no resolvable assignee before ever calling the RPC", async () => {
    const runId = `no-assignee-${Date.now()}`;
    const fixture = {
      tasks: [{ id: `${runId}-task`, clientId: clientLegacyId, title: "Orphaned", dueDate: "2026-01-01" }],
    };

    const result = runImporter(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/requires an assignee/i);
  }, 60_000);

  it("rejects a lead with no resolvable producer before ever calling the RPC", async () => {
    const runId = `no-producer-${Date.now()}`;
    const fixture = {
      leads: [
        {
          id: `${runId}-lead`,
          clientId: clientLegacyId,
          clientName: "Orphaned Lead",
          insuranceType: "Auto",
        },
      ],
    };

    const result = runImporter(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/requires a producer\/assignee/i);

    const { data } = await admin
      .from("leads")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", `${runId}-lead`);
    expect(data).toHaveLength(0);
  }, 60_000);
});
