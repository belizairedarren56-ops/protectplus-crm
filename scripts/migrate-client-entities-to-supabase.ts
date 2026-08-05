/**
 * One-time, human-run importer: takes a combined JSON export of the six
 * remaining Phase 3B entities (policies, quotes, tasks, documents,
 * client_notes, family_members) — each record still carrying whatever
 * legacy numeric client id the pre-migration `localStorage` shape used —
 * and writes them all into Supabase in one real database transaction via
 * the `import_client_entities()` RPC.
 *
 * Sibling to (not a rewrite of) migrate-clients-to-supabase.ts: clients
 * import first, independently, as always; this script runs AFTER, using
 * the already-imported clients' `legacy_id` column to resolve every
 * record's `clientId` reference to a real UUID.
 *
 * This phase builds and tests this script against LOCAL Supabase with
 * synthetic fixture data only — it is not run against any real captured
 * browser export, and no hosted project is ever a valid target until a
 * future, explicitly approved phase (matches migrate-clients-to-supabase.ts's
 * same typed-confirmation gate for anything non-local).
 *
 * Two-phase, same discipline as the clients importer: Phase A (read-only)
 * validates every record across ALL SIX arrays and resolves every
 * clientId/producer/assignee reference to a real UUID, collecting every
 * failure across the entire file before writing anything. Phase B is one
 * RPC call — a single plpgsql function body is one implicit transaction,
 * so any exception anywhere inside it (including a hypothetical
 * cross-agency FK violation Phase A somehow missed) rolls back all six
 * entities' writes together, not just one table's. This is the property
 * six independently-atomic-but-not-jointly-atomic PostgREST upserts could
 * never have delivered.
 *
 * Idempotency: policies/quotes/tasks/documents/family_members each carry
 * their own legacyId (the source record's original numeric id, as text)
 * under a unique(agency_id, legacy_id) constraint; family_members
 * synthesizes one (`${legacyClientId}-${index within that client's
 * family array}`) since it never had a real prior identity. client_notes
 * has no legacyId — it upserts against (agency_id, client_id) where
 * note_type = 'profile' instead, so re-running updates the same row in
 * place.
 *
 * Usage:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/migrate-client-entities-to-supabase.ts --file ./exported-entities.json --agency-id <uuid>
 */

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { mapProducerNameToProfileId } from "@/lib/producerMapping";
import { createServiceRoleClient } from "@/scripts/lib/serviceRoleClient";

type LegacyPolicy = {
  id: number | string;
  clientId: number | string;
  clientName: string;
  carrier: string;
  policyNumber: string;
  product: string;
  effectiveDate: string;
  expirationDate: string;
  status?: string;
  premium: number;
  producer?: string;
  assignedProducerName?: string;
};

type LegacyQuote = {
  id: number | string;
  clientId: number | string;
  clientName: string;
  carrier: string;
  premium: number;
  coverage?: string;
  insuranceType: string;
  status?: string;
  producer?: string;
  assignedProducerName?: string;
};

type LegacyTask = {
  id: number | string;
  clientId?: number | string;
  title: string;
  description?: string;
  priority?: string;
  dueDate: string;
  status?: string;
  assignedTo?: string;
  assignedToName?: string;
};

type LegacyDocument = {
  id: number | string;
  clientId?: number | string;
  name: string;
  folder: string;
  fileType?: string;
};

type LegacyClientNote = {
  clientId: number | string;
  body: string;
};

type LegacyFamilyMember = {
  clientId: number | string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
};

type CombinedImportFile = {
  policies?: LegacyPolicy[];
  quotes?: LegacyQuote[];
  tasks?: LegacyTask[];
  documents?: LegacyDocument[];
  clientNotes?: LegacyClientNote[];
  familyMembers?: LegacyFamilyMember[];
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
    "Type CONFIRM-HOSTED-IMPORT to confirm you intend to import client entity data into this HOSTED project: "
  );
  rl.close();

  if (typed.trim() !== "CONFIRM-HOSTED-IMPORT") {
    console.error("Confirmation text did not match. Aborting — nothing was imported.");
    process.exit(1);
  }
}

function producerName(record: { producer?: string; assignedProducerName?: string }): string | undefined {
  // assignedProducerName takes precedence — the field a record created
  // after the Phase 3A/3B id-format migration ran will actually have;
  // `producer` only ever appears on unmigrated, pre-migration records.
  return record.assignedProducerName ?? record.producer;
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
      "Usage: npx tsx scripts/migrate-client-entities-to-supabase.ts --file <path.json> --agency-id <uuid>"
    );
    process.exit(1);
  }

  await confirmHostedTarget(url);

  const admin = createServiceRoleClient();

  // ── Phase A: read-only. Nothing is written until every record across all
  // six arrays passes. ────────────────────────────────────────────────────

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error(`Could not read/parse ${filePath}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    console.error(
      `${filePath} must contain a JSON object with policies/quotes/tasks/documents/clientNotes/familyMembers arrays.`
    );
    process.exit(1);
  }

  const file = raw as CombinedImportFile;

  const { data: clientRows, error: clientsError } = await admin
    .from("clients")
    .select("id, legacy_id")
    .eq("agency_id", agencyId)
    .not("legacy_id", "is", null);

  if (clientsError) {
    console.error("Could not load this agency's imported clients:", clientsError.message);
    process.exit(1);
  }

  const clientLegacyToUuid = new Map<string, string>(
    (clientRows ?? []).map((row) => [row.legacy_id as string, row.id])
  );

  const { data: profileRows, error: profilesError } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("agency_id", agencyId);

  if (profilesError) {
    console.error("Could not load agency profiles for producer/assignee mapping:", profilesError.message);
    process.exit(1);
  }

  const profiles = (profileRows ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));
  const failures: string[] = [];

  function resolveClientId(label: string, index: number, clientId: number | string): string | undefined {
    const resolved = clientLegacyToUuid.get(String(clientId));
    if (!resolved) {
      failures.push(`${label} ${index}: unresolvable legacy clientId "${clientId}" — was this client imported?`);
    }
    return resolved;
  }

  function resolveProducerId(
    label: string,
    index: number,
    name: string | undefined
  ): string | undefined {
    if (!name) return undefined;
    const mapped = mapProducerNameToProfileId(name, profiles);
    if (!mapped.ok) {
      failures.push(
        `${label} ${index}: producer/assignee "${name}" ${
          mapped.reason === "ambiguous" ? "matches more than one profile" : "was not found"
        }.`
      );
      return undefined;
    }
    return mapped.profileId;
  }

  // policies.producer_id / quotes.producer_id / tasks.assigned_to are all
  // NOT NULL with no server-side default for the service-role caller this
  // RPC runs as (force_owner_*() only forces a value for a real end-user
  // auth.uid()) — every imported row of these three entities must resolve
  // a real assignee. A missing name is reported here; a present but
  // unresolvable name is already reported by resolveProducerId() itself,
  // so this doesn't duplicate that failure.
  function requireProducerId(label: string, index: number, name: string | undefined): string | undefined {
    if (!name) {
      failures.push(`${label} ${index}: requires a producer/assignee (none was provided).`);
    }
    return resolveProducerId(label, index, name);
  }

  const resolvedPolicies = (file.policies ?? []).map((record, index) => {
    const clientId = resolveClientId("Policy", index, record.clientId);
    const producerId = requireProducerId("Policy", index, producerName(record));
    return {
      legacyId: String(record.id),
      clientId,
      producerId,
      clientName: record.clientName,
      carrier: record.carrier,
      policyNumber: record.policyNumber,
      product: record.product,
      effectiveDate: record.effectiveDate,
      expirationDate: record.expirationDate,
      status: record.status,
      premium: record.premium,
    };
  });

  const resolvedQuotes = (file.quotes ?? []).map((record, index) => {
    const clientId = resolveClientId("Quote", index, record.clientId);
    const producerId = requireProducerId("Quote", index, producerName(record));
    return {
      legacyId: String(record.id),
      clientId,
      producerId,
      clientName: record.clientName,
      carrier: record.carrier,
      premium: record.premium,
      coverage: record.coverage,
      insuranceType: record.insuranceType,
      status: record.status,
    };
  });

  const resolvedTasks = (file.tasks ?? []).map((record, index) => {
    const clientId =
      record.clientId !== undefined ? resolveClientId("Task", index, record.clientId) : undefined;
    const assignedTo = requireProducerId("Task", index, record.assignedToName ?? record.assignedTo);
    return {
      legacyId: String(record.id),
      clientId,
      assignedTo,
      title: record.title,
      description: record.description,
      priority: record.priority,
      dueDate: record.dueDate,
      status: record.status,
    };
  });

  const resolvedDocuments = (file.documents ?? []).map((record, index) => {
    const clientId =
      record.clientId !== undefined ? resolveClientId("Document", index, record.clientId) : undefined;
    return {
      legacyId: String(record.id),
      clientId,
      folder: record.folder,
      name: record.name,
      fileType: record.fileType,
    };
  });

  const resolvedClientNotes = (file.clientNotes ?? []).map((record, index) => {
    const clientId = resolveClientId("Client note", index, record.clientId);
    return { clientId, body: record.body };
  });

  const familyMemberIndexByClient = new Map<string, number>();
  const resolvedFamilyMembers = (file.familyMembers ?? []).map((record, index) => {
    const legacyClientKey = String(record.clientId);
    const clientId = resolveClientId("Family member", index, record.clientId);
    const memberIndex = familyMemberIndexByClient.get(legacyClientKey) ?? 0;
    familyMemberIndexByClient.set(legacyClientKey, memberIndex + 1);
    return {
      legacyId: `${legacyClientKey}-${memberIndex}`,
      clientId,
      name: record.name,
      relationship: record.relationship,
      dateOfBirth: record.dateOfBirth,
    };
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} record(s) failed validation — importing NOTHING:\n`);
    failures.forEach((message) => console.error(`  - ${message}`));
    process.exit(1);
  }

  const totalRecords =
    resolvedPolicies.length +
    resolvedQuotes.length +
    resolvedTasks.length +
    resolvedDocuments.length +
    resolvedClientNotes.length +
    resolvedFamilyMembers.length;

  if (totalRecords === 0) {
    console.log("Nothing to import — the input file has no records across any entity.");
    return;
  }

  // ── Phase B: one RPC call, one transaction, all six tables. Either the
  // whole batch lands, or none of it does. ───────────────────────────────

  const { data, error } = await admin.rpc("import_client_entities", {
    p_agency_id: agencyId,
    p_policies: resolvedPolicies,
    p_quotes: resolvedQuotes,
    p_tasks: resolvedTasks,
    p_documents: resolvedDocuments,
    p_client_notes: resolvedClientNotes,
    p_family_members: resolvedFamilyMembers,
  });

  if (error) {
    console.error("Import failed — nothing was written:", error.message);
    process.exit(1);
  }

  const counts = data as {
    policies: number;
    quotes: number;
    tasks: number;
    documents: number;
    clientNotes: number;
    familyMembers: number;
  };

  console.log("\nDone. New/updated rows written:");
  console.log(`  policies:      ${counts.policies}`);
  console.log(`  quotes:        ${counts.quotes}`);
  console.log(`  tasks:         ${counts.tasks}`);
  console.log(`  documents:     ${counts.documents}`);
  console.log(`  clientNotes:   ${counts.clientNotes}`);
  console.log(`  familyMembers: ${counts.familyMembers}`);
}

main();
