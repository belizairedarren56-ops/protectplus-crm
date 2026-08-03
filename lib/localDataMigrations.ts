import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import { getItem, setItem } from "@/lib/storage";

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

function getStoredVersion(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(VERSION_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function setStoredVersion(version: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VERSION_KEY, String(version));
}

type Journal = { targetVersion: number; status: "in-progress"; keys: LegacyEntityName[] };

function writeJournal(journal: Journal): void {
  setItem(JOURNAL_KEY, journal);
}

function clearJournal(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(JOURNAL_KEY);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// clients: id -> String(id). The five clientId-bearing entities: clientId ->
// String(clientId), only when present (several are optional). notifications:
// identity — nothing to convert, just copied into the versioned namespace.
function transform(entity: LegacyEntityName, legacy: unknown[]): unknown[] {
  if (entity === "clients") {
    return legacy.map((raw) => {
      const record = raw as { id: number | string; [key: string]: unknown };
      return { ...record, id: String(record.id) };
    });
  }
  if (entity === "notifications") {
    return legacy;
  }
  return legacy.map((raw) => {
    const record = raw as { clientId?: number | string; [key: string]: unknown };
    if (record.clientId === undefined || record.clientId === null) return record;
    return { ...record, clientId: String(record.clientId) };
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

async function runMigration(): Promise<Result<void, DataBackendError>> {
  if (getStoredVersion() >= TARGET_VERSION) {
    return { ok: true, data: undefined };
  }

  writeJournal({ targetVersion: TARGET_VERSION, status: "in-progress", keys: MIGRATED_KEYS });

  for (const entity of MIGRATED_KEYS) {
    const legacy = getItem<unknown[]>(legacyKeyName(entity), []); // v1 key: read-only, never mutated
    const transformed = transform(entity, legacy);
    setItem(versionedKeyName(entity, TARGET_VERSION), transformed); // copy-on-write: a new key
    const verified = getItem<unknown[] | null>(versionedKeyName(entity, TARGET_VERSION), null);

    if (!deepEqual(verified, transformed)) {
      // Journal stays "in-progress" -> resumed next call; legacy source is
      // untouched throughout, so a retry from scratch is always safe.
      return {
        ok: false,
        error: { kind: "migration", message: `Verification failed writing the migrated "${entity}" key.` },
      };
    }
  }

  setStoredVersion(TARGET_VERSION); // the one true "commit" — only after every key verified
  clearJournal();
  return { ok: true, data: undefined };
}

// Must only be called after ensureLocalDataMigrated() has resolved
// successfully. No fallback to the legacy key on any other path — a caller
// that reaches this before migration is active gets a typed error, never a
// silent, writable route to what's supposed to be a permanently read-only
// backup.
export function activeLegacyKey(entity: LegacyEntityName): Result<string, DataBackendError> {
  if (getStoredVersion() < TARGET_VERSION) {
    return {
      ok: false,
      error: {
        kind: "migration",
        message: `Migration to v${TARGET_VERSION} is not active; refusing to resolve a key for "${entity}".`,
      },
    };
  }
  return { ok: true, data: versionedKeyName(entity, TARGET_VERSION) };
}

// Test-only escape hatch: resets in-memory module state to simulate a fresh
// page load/reload, where localStorage persists but all JS module state does
// not.
export function __resetMigrationStateForTests(): void {
  inFlight = null;
}
