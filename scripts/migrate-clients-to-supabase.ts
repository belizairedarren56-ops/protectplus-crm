/**
 * One-time, human-run importer: takes an exported `localStorage` clients
 * JSON array (the pre-Phase-3A shape, with a numeric `id` and a free-text
 * `producer` string) and creates the equivalent rows in Supabase.
 *
 * This phase builds and tests this script against LOCAL Supabase with
 * synthetic fixture data only — it is not run against any real captured
 * browser export, and no hosted project is ever a valid target until a
 * future, explicitly approved phase (matches scripts/bootstrap-admin.ts's
 * same typed-confirmation gate for anything non-local).
 *
 * Idempotency: every imported row gets a `legacy_id` (the source record's
 * original numeric id, as text) under a `unique (agency_id, legacy_id)`
 * constraint (see supabase/migrations/20260803000003_add_client_legacy_id.sql).
 * Re-running against the same file is a plain `upsert(...,
 * { onConflict: "agency_id,legacy_id", ignoreDuplicates: true })` — already-
 * imported rows are skipped, nothing is ever duplicated.
 *
 * Two-phase: Phase A (read-only) validates every record's shape and
 * resolves every `producer` name via mapProducerNameToProfileId() for
 * *every* record, collecting every failure across the whole file before
 * writing anything. Phase B is one atomic batch upsert — PostgREST executes
 * an array insert/upsert as a single statement, so a mid-import failure
 * cannot leave a partial, undocumented import: either the whole batch
 * lands, or none of it does.
 *
 * Usage:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/migrate-clients-to-supabase.ts --file ./exported-clients.json --agency-id <uuid>
 */

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { mapProducerNameToProfileId } from "@/lib/producerMapping";
import type { Database } from "@/lib/supabase/database.types";
import { createServiceRoleClient } from "@/scripts/lib/serviceRoleClient";

type LegacyClient = {
  id: number | string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  policyType?: string;
  status?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  carrier?: string;
  policyNumber?: string;
  insuranceTypes?: string[];
  /** Pre-Phase-3A shape. */
  producer?: string;
  /** Phase-3A-and-later shape (see lib/localDataMigrations.ts's transform,
   * which renames producer -> assignedProducerName during the id-format
   * migration) — a client created after that migration ran will only ever
   * have this field, never `producer`. */
  assignedProducerName?: string;
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function confirmHostedTarget(url: string): Promise<void> {
  const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
  if (isLocal) return;

  console.log(`\nTarget URL: ${url}`);
  console.log("This does not look like a local Supabase instance.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = await rl.question(
    "Type CONFIRM-HOSTED-IMPORT to confirm you intend to import client data into this HOSTED project: "
  );
  rl.close();

  if (typed.trim() !== "CONFIRM-HOSTED-IMPORT") {
    console.error("Confirmation text did not match. Aborting — nothing was imported.");
    process.exit(1);
  }
}

function isValidLegacyClient(record: unknown): record is LegacyClient {
  if (typeof record !== "object" || record === null) return false;
  const candidate = record as Record<string, unknown>;
  return (
    (typeof candidate.id === "number" || typeof candidate.id === "string") &&
    typeof candidate.firstName === "string" &&
    candidate.firstName.length > 0 &&
    typeof candidate.lastName === "string" &&
    candidate.lastName.length > 0
  );
}

async function main() {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script.");
    process.exit(1);
  }

  const filePath = arg("file");
  const agencyId = arg("agency-id");

  if (!filePath || !agencyId) {
    console.error(
      "Usage: npx tsx scripts/migrate-clients-to-supabase.ts --file <path.json> --agency-id <uuid>"
    );
    process.exit(1);
  }

  await confirmHostedTarget(url);

  const admin = createServiceRoleClient();

  // ── Phase A: read-only validation + producer mapping. Nothing is written
  // until every record in the file passes. ────────────────────────────────

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error(`Could not read/parse ${filePath}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }

  if (!Array.isArray(raw)) {
    console.error(`${filePath} must contain a JSON array of client records.`);
    process.exit(1);
  }

  const { data: profileRows, error: profilesError } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("agency_id", agencyId);

  if (profilesError) {
    console.error("Could not load agency profiles for producer mapping:", profilesError.message);
    process.exit(1);
  }

  const profiles = (profileRows ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));
  const failures: string[] = [];
  const validated: Database["public"]["Tables"]["clients"]["Insert"][] = [];

  raw.forEach((record, index) => {
    if (!isValidLegacyClient(record)) {
      failures.push(`Record ${index}: missing/invalid id, firstName, or lastName.`);
      return;
    }

    let assignedProducerId: string | undefined;
    // assignedProducerName takes precedence — it's the field a client
    // created after the Phase 3A id-format migration ran will actually
    // have; `producer` only ever appears on unmigrated, pre-Phase-3A
    // records. Both are the same free-text producer display name, just
    // under the two field names this app has used across that migration.
    const producerName = record.assignedProducerName ?? record.producer;
    if (producerName) {
      const mapped = mapProducerNameToProfileId(producerName, profiles);
      if (!mapped.ok) {
        failures.push(
          `Record ${index} (${record.firstName} ${record.lastName}): producer "${producerName}" ${
            mapped.reason === "ambiguous" ? "matches more than one profile" : "was not found"
          }.`
        );
        return;
      }
      assignedProducerId = mapped.profileId;
    }

    validated.push({
      agency_id: agencyId,
      legacy_id: String(record.id),
      first_name: record.firstName,
      last_name: record.lastName,
      phone: record.phone ?? null,
      email: record.email ?? null,
      status: (record.status as Database["public"]["Tables"]["clients"]["Row"]["status"]) ?? "New Lead",
      address: record.address ?? null,
      city: record.city ?? null,
      state: record.state ?? null,
      zip: record.zip ?? null,
      carrier: record.carrier ?? null,
      policy_number: record.policyNumber ?? null,
      insurance_types: (record.insuranceTypes ?? (record.policyType ? [record.policyType] : [])) as Database["public"]["Tables"]["clients"]["Row"]["insurance_types"],
      assigned_producer_id: assignedProducerId,
      is_demo: false,
    });
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} record(s) failed validation — importing NOTHING:\n`);
    failures.forEach((message) => console.error(`  - ${message}`));
    process.exit(1);
  }

  if (validated.length === 0) {
    console.log("Nothing to import — the input file has no valid records.");
    return;
  }

  // ── Phase B: one atomic batch upsert. Either the whole batch lands, or
  // none of it does — no partial, undocumented import is possible. Already-
  // imported rows (matched by (agency_id, legacy_id)) are skipped, so
  // re-running against the same file is safely idempotent. ────────────────

  const { data: inserted, error: insertError } = await admin
    .from("clients")
    .upsert(validated, { onConflict: "agency_id,legacy_id", ignoreDuplicates: true })
    .select("id, legacy_id");

  if (insertError) {
    console.error("Import batch failed — nothing was written:", insertError.message);
    process.exit(1);
  }

  console.log(
    `\nDone. ${inserted?.length ?? 0} new client(s) imported out of ${validated.length} in the file ` +
      `(the rest, if any, were already imported previously and were skipped).`
  );
}

main();
