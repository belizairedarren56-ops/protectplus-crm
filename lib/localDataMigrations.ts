import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import { setItem } from "@/lib/storage";

// Copy-on-write, journaled local-data migration. Legacy keys
// (protectplus-clients, etc.) are only ever READ, never mutated — they are
// the backup, by construction, not a separate copy that could itself get
// corrupted. Every transformed write goes to a new, versioned key
// (protectplus-clients@v2); the "commit" is a single version-pointer write,
// made only after every versioned key has been written AND read back to
// verify it round-tripped correctly.
//
// Why this exists: Client.id (and every clientId cross-reference) changes
// from number to string this phase. A developer's existing browser data is
// still numeric-id-shaped; this migration converts it exactly once, safely,
// resumably, and without ever touching the original data.

const TARGET_VERSION = 2;
const VERSION_KEY = "protectplus-storage-schema-version";
const JOURNAL_KEY = "protectplus-migration-journal";

// The complete, final list: clients, the five clientId-bearing entities, and
// notifications (identity transform — no clientId to convert, but it's still
// copied into the versioned namespace so activeLegacyKey("notifications")
// has something to resolve to, matching every other entity's treatment).
export type LegacyEntityName =
  | "clients"
  | "leads"
  | "quotes"
  | "policies"
  | "tasks"
  | "documents"
  | "notifications";

const MIGRATED_KEYS: LegacyEntityName[] = [
  "clients",
  "leads",
  "quotes",
  "policies",
  "tasks",
  "documents",
  "notifications",
];

function legacyKeyName(entity: LegacyEntityName): string {
  return `protectplus-${entity}`;
}

function versionedKeyName(entity: LegacyEntityName, version: number): string {
  return `protectplus-${entity}@v${version}`;
}

function migrationError(message: string, cause?: unknown): { ok: false; error: DataBackendError } {
  return { ok: false, error: { kind: "migration", message, cause } };
}

function getStoredVersion(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(VERSION_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

type Journal = { targetVersion: number; status: "in-progress"; keys: LegacyEntityName[] };

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Strict legacy read: a key that's genuinely absent (fresh install, nothing
// migrated yet) is NOT an error — it resolves to an empty array, same as
// before. A key that's PRESENT but fails to parse (or isn't a JSON array) IS
// a real, typed error — unlike lib/storage.ts's getItem(), which silently
// swallows a parse failure and returns the fallback, indistinguishable from
// "no data." That silent fallback is wrong here: it would let the migration
// quietly discard corrupted legacy data instead of surfacing it, and could
// let a truncated/corrupted legacy file appear to migrate successfully.
function readLegacyStrict(entity: LegacyEntityName): Result<unknown[], DataBackendError> {
  const key = legacyKeyName(entity);
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch (error) {
    return migrationError(`Could not read legacy localStorage key "${key}".`, error);
  }

  if (raw === null) return { ok: true, data: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return migrationError(`Legacy data at "${key}" is not valid JSON — refusing to migrate it.`, error);
  }

  if (!Array.isArray(parsed)) {
    return migrationError(`Legacy data at "${key}" is not a JSON array — refusing to migrate it.`);
  }

  return { ok: true, data: parsed };
}

// Entities whose OWN id becomes a string, not just their clientId
// references — grows as each entity's Phase 3B slice lands (Document.id,
// Task.id, Quote.id today; Policy.id joins this list when its own slice
// changes its type from number to string). Leads stays off this list —
// Lead.id remains a number until Phase 3C migrates leads — so this must
// never grow ahead of an entity's actual type change, or that entity's
// still-untouched UI (numeric id comparisons, etc.) would silently break.
const ENTITIES_WITH_STRING_ID: LegacyEntityName[] = ["documents", "tasks", "quotes"];

// Entities whose pre-Phase-3B shape had a plain-text producer/assignee
// field, since renamed to a `*Name` field matching the entity's real
// ownership column (assignedToName for tasks — deliberately not
// "assignedProducer", matching Task.assignedToId's own naming;
// assignedProducerName for quotes/policies, matching Client's Phase 3A
// precedent). Maps the OLD field name to the NEW one so a pre-existing
// browser's stored assignment isn't silently orphaned by the rename — same
// failure mode the "clients" branch below already guards against for its
// own producer -> assignedProducerName rename.
const ASSIGNEE_FIELD_RENAMES: Partial<Record<LegacyEntityName, { from: string; to: string }>> = {
  tasks: { from: "assignedTo", to: "assignedToName" },
  quotes: { from: "producer", to: "assignedProducerName" },
};

// clients: id -> String(id), and the legacy free-text `producer` field
// (pre-Phase-3A shape) renamed to assignedProducerName — the field every
// current UI path actually reads. Without this rename, a browser's existing
// producer assignment would silently become unreadable after migration:
// still present in the raw stored JSON, but orphaned, since Client no longer
// has a `producer` field at all. The five clientId-bearing entities:
// clientId -> String(clientId), only when present (several are optional),
// and (for entities in ENTITIES_WITH_STRING_ID) their own id -> String(id)
// too. notifications: identity — nothing to convert, just copied into the
// versioned namespace.
function transform(entity: LegacyEntityName, legacy: unknown[]): unknown[] {
  if (entity === "clients") {
    return legacy.map((raw) => {
      const record = raw as {
        id: number | string;
        producer?: string;
        assignedProducerName?: string;
        [key: string]: unknown;
      };
      const { producer, ...rest } = record;
      return {
        ...rest,
        id: String(record.id),
        assignedProducerName: record.assignedProducerName ?? producer,
      };
    });
  }
  if (entity === "notifications") {
    return legacy;
  }

  const stringifyOwnId = ENTITIES_WITH_STRING_ID.includes(entity);
  const rename = ASSIGNEE_FIELD_RENAMES[entity];
  return legacy.map((raw) => {
    const record = raw as { id?: number | string; clientId?: number | string; [key: string]: unknown };
    const next: Record<string, unknown> = { ...record };
    if (stringifyOwnId && record.id !== undefined && record.id !== null) {
      next.id = String(record.id);
    }
    if (record.clientId !== undefined && record.clientId !== null) {
      next.clientId = String(record.clientId);
    }
    if (rename) {
      const oldValue = next[rename.from];
      delete next[rename.from];
      if (next[rename.to] === undefined) next[rename.to] = oldValue;
    }
    return next;
  });
}

let inFlight: Promise<Result<void, DataBackendError>> | null = null;

// Memoized: every same-tab concurrent caller (React Strict Mode's double
// effect invocation, multiple entity hooks mounting together, etc.) awaits
// the same in-flight run instead of racing independent ones. Safe even
// without this, since the migration is idempotent by construction (it never
// mutates its own source), but this avoids redundant work.
export function ensureLocalDataMigrated(): Promise<Result<void, DataBackendError>> {
  if (!inFlight) inFlight = runMigration();
  return inFlight;
}

// Pure — no browser API access — so it's directly unit-testable without
// needing to simulate real event timing. A `storage` event only ever fires
// in OTHER tabs/windows than the one that made the change (the browser
// never delivers it back to the writer), which is exactly the cross-tab
// notification this needs: "some other tab just finished."
export function signalsAnotherTabCompletedMigration(event: Pick<StorageEvent, "key" | "newValue">): boolean {
  if (event.key !== VERSION_KEY || event.newValue === null) return false;
  const version = Number(event.newValue);
  return Number.isFinite(version) && version >= TARGET_VERSION;
}

// Copy-on-write already makes a genuine cross-tab race harmless by
// construction (both tabs read the same untouched legacy source and compute
// the same deterministic output, so redundant work converges rather than
// conflicts) — this is a pure optimization on top of that guarantee, not a
// correctness requirement. Races our own run against a `storage` event
// signaling another tab already finished, so this tab can skip doing the
// same (safe, but pointless) work over again the instant that happens.
function runMigrationRacingOtherTabs(): Promise<Result<void, DataBackendError>> {
  if (typeof window === "undefined") return runMigrationSafe();

  return new Promise((resolve) => {
    let settled = false;

    function finish(result: Result<void, DataBackendError>) {
      if (settled) return;
      settled = true;
      window.removeEventListener("storage", onStorage);
      resolve(result);
    }

    function onStorage(event: StorageEvent) {
      if (signalsAnotherTabCompletedMigration(event)) finish({ ok: true, data: undefined });
    }

    window.addEventListener("storage", onStorage);
    runMigrationSafe().then(finish);
  });
}

// Every localStorage read/write below can throw for real (quota exceeded,
// private-browsing restrictions, a security policy blocking storage
// access, ...) — this top-level guard is the backstop that guarantees
// ensureLocalDataMigrated() always RESOLVES with a typed Result and never
// REJECTS, regardless of where an exception originates. The more targeted
// error handling below (readLegacyStrict, the per-key try/catches) exists
// to bail out at exactly the right point — before any versioned write for a
// malformed entity, before the version pointer ever flips — rather than
// relying solely on this catch-all for correctness.
async function runMigrationSafe(): Promise<Result<void, DataBackendError>> {
  try {
    return await runMigrationUnsafe();
  } catch (error) {
    return migrationError("Unexpected error during local data migration.", error);
  }
}

async function runMigration(): Promise<Result<void, DataBackendError>> {
  if (getStoredVersion() >= TARGET_VERSION) {
    // Already migrated (possibly by another tab, possibly by this one on a
    // prior call) — nothing to race, nothing to listen for.
    return { ok: true, data: undefined };
  }
  return runMigrationRacingOtherTabs();
}

async function runMigrationUnsafe(): Promise<Result<void, DataBackendError>> {
  if (getStoredVersion() >= TARGET_VERSION) {
    return { ok: true, data: undefined };
  }

  const journal: Journal = { targetVersion: TARGET_VERSION, status: "in-progress", keys: MIGRATED_KEYS };
  try {
    setItem(JOURNAL_KEY, journal);
  } catch (error) {
    return migrationError("Could not write the migration journal.", error);
  }

  for (const entity of MIGRATED_KEYS) {
    const legacyResult = readLegacyStrict(entity); // v1 key: read-only, never mutated
    if (!legacyResult.ok) return legacyResult; // malformed JSON: stop here — no versioned write, no pointer flip

    const transformed = transform(entity, legacyResult.data);
    const versionedKey = versionedKeyName(entity, TARGET_VERSION);

    try {
      setItem(versionedKey, transformed); // copy-on-write: a new key
    } catch (error) {
      return migrationError(`Could not write the migrated "${entity}" key.`, error);
    }

    let verifiedRaw: string | null;
    try {
      verifiedRaw = window.localStorage.getItem(versionedKey);
    } catch (error) {
      return migrationError(`Could not read back the migrated "${entity}" key for verification.`, error);
    }

    const verified = verifiedRaw ? (JSON.parse(verifiedRaw) as unknown) : null;
    if (!deepEqual(verified, transformed)) {
      // Journal stays "in-progress" -> resumed next call; legacy source is
      // untouched throughout, so a retry from scratch is always safe.
      return migrationError(`Verification failed writing the migrated "${entity}" key.`);
    }
  }

  try {
    window.localStorage.setItem(VERSION_KEY, String(TARGET_VERSION)); // the one true "commit" — only after every key verified
  } catch (error) {
    return migrationError("Could not write the local data migration version pointer.", error);
  }

  try {
    window.localStorage.removeItem(JOURNAL_KEY);
  } catch (error) {
    // Non-fatal: the version pointer above already committed successfully,
    // so migration genuinely succeeded — a lingering journal entry is inert
    // (runMigrationUnsafe() short-circuits on the version check before ever
    // reading the journal again) and not worth failing the whole result over.
    console.error("Could not clear the migration journal after a successful migration:", error);
  }

  return { ok: true, data: undefined };
}

// Must only be called after ensureLocalDataMigrated() has resolved
// successfully. No fallback to the legacy key on any other path — a caller
// that reaches this before migration is active gets a typed error, never a
// silent, writable route to what's supposed to be a permanently read-only
// backup.
export function activeLegacyKey(entity: LegacyEntityName): Result<string, DataBackendError> {
  let version: number;
  try {
    version = getStoredVersion();
  } catch (error) {
    return migrationError("Could not read the local data migration version.", error);
  }

  if (version < TARGET_VERSION) {
    return migrationError(
      `Migration to v${TARGET_VERSION} is not active; refusing to resolve a key for "${entity}".`
    );
  }
  return { ok: true, data: versionedKeyName(entity, TARGET_VERSION) };
}

// Test-only escape hatch: resets in-memory module state to simulate a fresh
// page load/reload, where localStorage persists but all JS module state does
// not.
export function __resetMigrationStateForTests(): void {
  inFlight = null;
}
