import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestAgency,
  createTestUser,
  deleteTestAgency,
  deleteTestUser,
  serviceClient,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  type TestUser,
} from "../rls/helpers";

// Exercises scripts/migrate-clients-to-supabase.ts exactly as a human would
// run it — a real subprocess, real CLI args, a real fixture file on disk —
// against real local Supabase, proving the idempotency and all-or-nothing
// guarantees the Revision 4.2 plan promised tests for (correction #10) but
// this phase's earlier test pass never actually wrote.

const admin = serviceClient();

let agencyId: string;
let producer: TestUser;
let tmpDir: string;

function runImporter(fixture: unknown[]): { status: number; stdout: string; stderr: string } {
  const filePath = join(tmpDir, `fixture-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(filePath, JSON.stringify(fixture));

  try {
    const stdout = execFileSync(
      "npx",
      ["tsx", "scripts/migrate-clients-to-supabase.ts", "--file", filePath, "--agency-id", agencyId],
      {
        env: {
          ...process.env,
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
        },
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

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Importer Test Agency ${Date.now()}`);
  producer = await createTestUser(admin, { agencyId, role: "producer", fullName: "Maria Gonzalez" });
  tmpDir = mkdtempSync(join(tmpdir(), "protectplus-importer-test-"));
}, 30_000);

afterAll(async () => {
  await deleteTestUser(admin, producer?.userId);
  await deleteTestAgency(admin, agencyId);
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("scripts/migrate-clients-to-supabase.ts — real subprocess against local Supabase", () => {
  it("imports valid records and is idempotent on a second run of the same file", async () => {
    const legacyId = `legacy-${Date.now()}`;
    const fixture = [
      {
        id: legacyId,
        firstName: "Imported",
        lastName: "Once",
        phone: "954-555-0101",
        email: "imported.once@example.test",
        policyType: "Auto",
        status: "Active",
        producer: "Maria Gonzalez",
      },
    ];

    const first = runImporter(fixture);
    expect(first.status).toBe(0);
    expect(first.stdout).toMatch(/1 new client\(s\) imported out of 1/);

    const { data: afterFirst, error: firstError } = await admin
      .from("clients")
      .select("id, legacy_id, assigned_producer_id, first_name")
      .eq("agency_id", agencyId)
      .eq("legacy_id", legacyId);
    expect(firstError).toBeNull();
    expect(afterFirst).toHaveLength(1);
    expect((afterFirst as { assigned_producer_id: string }[])[0].assigned_producer_id).toBe(producer.userId);

    // Re-running against the SAME file (same legacy_id) must insert zero new
    // rows — the unique(agency_id, legacy_id) constraint plus
    // ignoreDuplicates makes this idempotent by construction.
    const second = runImporter(fixture);
    expect(second.status).toBe(0);
    expect(second.stdout).toMatch(/0 new client\(s\) imported out of 1/);

    const { data: afterSecond, error: secondError } = await admin
      .from("clients")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", legacyId);
    expect(secondError).toBeNull();
    expect(afterSecond).toHaveLength(1); // still exactly one row, not two
  }, 60_000);

  it("recognizes the new assignedProducerName field, not just the legacy producer field", async () => {
    const legacyId = `legacy-new-shape-${Date.now()}`;
    const fixture = [
      {
        id: legacyId,
        firstName: "PostMigration",
        lastName: "Client",
        phone: "",
        email: "",
        policyType: "Auto",
        status: "New Lead",
        // Phase-3A-and-later shape (lib/localDataMigrations.ts renames
        // producer -> assignedProducerName) — no `producer` field at all.
        assignedProducerName: "Maria Gonzalez",
      },
    ];

    const result = runImporter(fixture);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/1 new client\(s\) imported out of 1/);

    const { data, error } = await admin
      .from("clients")
      .select("assigned_producer_id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", legacyId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect((data as { assigned_producer_id: string }[])[0].assigned_producer_id).toBe(producer.userId);
  }, 60_000);

  it("is all-or-nothing: one invalid row blocks the entire batch, even when every other row is valid", async () => {
    const goodLegacyId = `legacy-good-${Date.now()}`;
    const fixture = [
      {
        id: goodLegacyId,
        firstName: "Would",
        lastName: "HaveImported",
        phone: "",
        email: "",
        policyType: "Auto",
        status: "New Lead",
        producer: "Maria Gonzalez",
      },
      {
        id: `legacy-bad-${Date.now()}`,
        firstName: "Bad",
        lastName: "Producer",
        phone: "",
        email: "",
        policyType: "Auto",
        status: "New Lead",
        producer: "Someone Who Does Not Exist",
      },
    ];

    const result = runImporter(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/failed validation/i);

    // Not even the row with a valid producer was written — Phase A
    // validates every record before Phase B writes anything at all.
    const { data, error } = await admin
      .from("clients")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("legacy_id", goodLegacyId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  }, 60_000);
});
