import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import { setItem } from "@/lib/storage";

// Copy-on-write, journaled local-data migration, run as an ordered sequence
// of versioned steps. Legacy keys (protectplus-clients, etc. — the v1
// source) and, once produced, each step's own versioned output are only
// ever READ by a later step — never mutated — so each becomes a
// permanent, inert backup by construction, not a separate copy that could
// itself get corrupted. Every transformed write goes to a new, versioned
// key (protectplus-clients@v2, @v3, ...); a step's "commit" is a single
// version-pointer write, made only after every one of that step's
// versioned keys has been written AND read back to verify it round-tripped
// correctly.
//
// Why a second step (v2 -> v3) exists, and why it is NOT a re-run of
// v1 -> v2: Phase 3A's v1 -> v2 step converted Client.id (and every
// clientId reference) from number to string. Phase 3C converts Lead.id and
// Lead.producer the same way — but by the time Phase 3C ships, every real
// installation has ALREADY committed to v2 (ensureLocalDataMigrated()
// short-circuits once the version pointer is at or past its target).
// Re-deriving from the original v1 legacy keys again would silently
// discard any lead (or anything else) created, edited, or deleted since v2
// first committed, replacing genuinely current data with a stale snapshot.
// The correct migration for an already-v2 install is a genuinely NEW step,
// v2 -> v3, sourced from the ACTIVE v2 keys — never v1 again once v2 is
// active.

const LATEST_VERSION = 3;
const VERSION_KEY = "protectplus-storage-schema-version";
const JOURNAL_KEY = "protectplus-migration-journal";

// The complete, final list: clients, the five clientId-bearing entities,
// leads, and notifications (identity transform at v1 -> v2 for
// notifications — no clientId to convert — but still copied into each
// versioned namespace so activeLegacyKey("notifications") has something to
// resolve to, matching every other entity's treatment).
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

// Strict source read, shared by every step. A key that's PRESENT but fails
// to parse (or isn't a JSON array) is ALWAYS a real, typed error —
// unlike lib/storage.ts's getItem(), which silently swallows a parse
// failure and returns the fallback, indistinguishable from "no data." That
// silent fallback is wrong here: it would let the migration quietly
// discard corrupted data instead of surfacing it.
//
// Whether a genuinely ABSENT key is valid depends on the step:
// missingSourceIsEmpty is true only for v1 -> v2's legacy source, where a
// fresh install has simply never written protectplus-{entity} at all —
// that's the normal, expected case. It is false for v2 -> v3's source: any
// installation whose version pointer already reads >= 2 MUST have every
// @v2 key already written (even an empty entity was written and verified
// as "[]" — the write-then-read-back loop below never leaves a key
// unwritten). A missing @v2 key there is never legitimately "nothing to
// migrate yet" — it's evidence of real corruption or a partial deletion,
// and must never be silently treated as an empty array, which could turn
// that loss into a permanent, undetected one the moment @v3 commits.
function readSourceStrict(sourceKey: string, missingSourceIsEmpty: boolean): Result<unknown[], DataBackendError> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(sourceKey);
  } catch (error) {
    return migrationError(`Could not read source key "${sourceKey}".`, error);
  }

  if (raw === null) {
    if (missingSourceIsEmpty) return { ok: true, data: [] };
    return migrationError(`Expected active source key "${sourceKey}" to already exist, but it was missing.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return migrationError(`Data at "${sourceKey}" is not valid JSON — refusing to migrate it.`, error);
  }

  if (!Array.isArray(parsed)) {
    return migrationError(`Data at "${sourceKey}" is not a JSON array — refusing to migrate it.`);
  }

  return { ok: true, data: parsed };
}

// v1 -> v2 (Phase 3A/3B): entities whose OWN id becomes a string, not just
// their clientId references — leads is deliberately NOT in this list; its
// own id/producer conversion happens at v2 -> v3 instead (see
// transformV2ToV3), matching when Lead.id/Lead.producer actually change
// type in the app. This must never grow ahead of an entity's actual type
// change, or that entity's still-untouched UI would silently break.
const ENTITIES_WITH_STRING_ID: LegacyEntityName[] = ["documents", "tasks", "quotes", "policies"];

// v1 -> v2 (Phase 3A/3B): entities whose pre-migration shape had a
// plain-text producer/assignee field, since renamed to a `*Name` field
// matching the entity's real ownership column. leads is deliberately NOT
// in this map for the same reason as above — see transformV2ToV3.
const ASSIGNEE_FIELD_RENAMES: Partial<Record<LegacyEntityName, { from: string; to: string }>> = {
  tasks: { from: "assignedTo", to: "assignedToName" },
  quotes: { from: "producer", to: "assignedProducerName" },
  policies: { from: "producer", to: "assignedProducerName" },
};

// v1 -> v2: clients: id -> String(id), and the legacy free-text `producer`
// field (pre-Phase-3A shape) renamed to assignedProducerName. The five
// clientId-bearing entities (including leads): clientId -> String(clientId),
// only when present, and (for entities in ENTITIES_WITH_STRING_ID) their
// own id -> String(id) too. leads' own id/producer are untouched at this
// step (see ENTITIES_WITH_STRING_ID/ASSIGNEE_FIELD_RENAMES above) — only
// its clientId converts here, via the same generic per-entity branch every
// other non-clients entity uses. notifications: identity — nothing to
// convert, just copied into the versioned namespace.
function transformV1ToV2(entity: LegacyEntityName, source: unknown[]): unknown[] {
  if (entity === "clients") {
    return source.map((raw) => {
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
    return source;
  }

  const stringifyOwnId = ENTITIES_WITH_STRING_ID.includes(entity);
  const rename = ASSIGNEE_FIELD_RENAMES[entity];
  return source.map((raw) => {
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

// v2 -> v3 (Phase 3C): leads join the string-id/renamed-producer-field
// shape every other entity already reached at v2. Every other entity is
// already in its final shape as of v2 — copied through unchanged.
function transformV2ToV3(entity: LegacyEntityName, source: unknown[]): unknown[] {
  if (entity !== "leads") return source;
  return source.map((raw) => {
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

type MigrationStep = {
  toVersion: number;
  // v1 -> v2 reads the v1 legacy keys (frozen, read-only, unchanged since
  // Phase 3A). v2 -> v3 reads the ACTIVE v2 keys — whatever a real
  // installation currently holds there, including every edit made since
  // v2 first committed — never the v1 snapshot again.
  sourceKeyName: (entity: LegacyEntityName) => string;
  keys: LegacyEntityName[];
  transform: (entity: LegacyEntityName, source: unknown[]) => unknown[];
  missingSourceIsEmpty: boolean;
};

const STEP_V1_TO_V2: MigrationStep = {
  toVersion: 2,
  sourceKeyName: legacyKeyName,
  keys: MIGRATED_KEYS,
  transform: transformV1ToV2,
  missingSourceIsEmpty: true,
};

const STEP_V2_TO_V3: MigrationStep = {
  toVersion: 3,
  sourceKeyName: (entity) => versionedKeyName(entity, 2),
  keys: MIGRATED_KEYS,
  transform: transformV2ToV3,
  missingSourceIsEmpty: false,
};

const STEPS: MigrationStep[] = [STEP_V1_TO_V2, STEP_V2_TO_V3];

let inFlight: Promise<Result<void, DataBackendError>> | null = null;

// Memoized: every same-tab concurrent caller (React Strict Mode's double
// effect invocation, multiple entity hooks mounting together, etc.) awaits
// the same in-flight run instead of racing independent ones. Safe even
// without this, since the migration is idempotent by construction (no step
// ever mutates its own source), but this avoids redundant work.
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
  return Number.isFinite(version) && version >= LATEST_VERSION;
}

// Copy-on-write already makes a genuine cross-tab race harmless by
// construction (both tabs read the same untouched source and compute the
// same deterministic output, so redundant work converges rather than
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
// REJECTS, regardless of where an exception originates.
async function runMigrationSafe(): Promise<Result<void, DataBackendError>> {
  try {
    return await runMigrationUnsafe();
  } catch (error) {
    return migrationError("Unexpected error during local data migration.", error);
  }
}

async function runMigration(): Promise<Result<void, DataBackendError>> {
  // This runs BEFORE runMigrationSafe()'s own try/catch is ever entered —
  // without its own guard here, a throwing getStoredVersion() (storage
  // access blocked, a security policy, ...) would propagate out of this
  // async function as a REJECTED promise, breaking
  // ensureLocalDataMigrated()'s guarantee that it always resolves with a
  // typed Result and never rejects.
  let version: number;
  try {
    version = getStoredVersion();
  } catch (error) {
    return migrationError("Could not read the local data migration version.", error);
  }

  if (version >= LATEST_VERSION) {
    // Already migrated (possibly by another tab, possibly by this one on a
    // prior call) — nothing to race, nothing to listen for.
    return { ok: true, data: undefined };
  }
  return runMigrationRacingOtherTabs();
}

// Runs every step whose target version hasn't been committed yet, in
// order. An installation already at v2 skips STEP_V1_TO_V2 entirely (its
// toVersion, 2, is not greater than the current version) and only runs
// STEP_V2_TO_V3; a fresh (version-0) installation runs both, in one pass,
// with STEP_V2_TO_V3 sourced from the @v2 keys STEP_V1_TO_V2 just wrote.
async function runMigrationUnsafe(): Promise<Result<void, DataBackendError>> {
  for (const step of STEPS) {
    if (getStoredVersion() >= step.toVersion) continue;
    const result = await runStep(step);
    if (!result.ok) return result; // version pointer never advances past a failing step; the next load resumes exactly here
  }
  return { ok: true, data: undefined };
}

async function runStep(step: MigrationStep): Promise<Result<void, DataBackendError>> {
  const journal: Journal = { targetVersion: step.toVersion, status: "in-progress", keys: step.keys };
  try {
    setItem(JOURNAL_KEY, journal);
  } catch (error) {
    return migrationError("Could not write the migration journal.", error);
  }

  for (const entity of step.keys) {
    const sourceKey = step.sourceKeyName(entity);
    const sourceResult = readSourceStrict(sourceKey, step.missingSourceIsEmpty);
    if (!sourceResult.ok) return sourceResult; // malformed/missing source: stop here — no versioned write, no pointer flip

    const transformed = step.transform(entity, sourceResult.data);
    const versionedKey = versionedKeyName(entity, step.toVersion);

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
      // Journal stays "in-progress" -> resumed next call; every source this
      // step reads from is untouched throughout, so a retry is always safe.
      return migrationError(`Verification failed writing the migrated "${entity}" key.`);
    }
  }

  try {
    window.localStorage.setItem(VERSION_KEY, String(step.toVersion)); // the one true "commit" for this step — only after every key verified
  } catch (error) {
    return migrationError("Could not write the local data migration version pointer.", error);
  }

  try {
    window.localStorage.removeItem(JOURNAL_KEY);
  } catch (error) {
    // Non-fatal: the version pointer above already committed successfully,
    // so this step genuinely succeeded — a lingering journal entry is inert
    // (the next step's own journal write overwrites it, or — if this was
    // the last step — nothing ever reads it again) and not worth failing
    // the whole result over.
    console.error("Could not clear the migration journal after a successful migration step:", error);
  }

  return { ok: true, data: undefined };
}

// Must only be called after ensureLocalDataMigrated() has resolved
// successfully. No fallback to any earlier version's key on any other
// path — a caller that reaches this before migration is fully active gets
// a typed error, never a silent, writable route to what's supposed to be a
// permanently read-only backup.
export function activeLegacyKey(entity: LegacyEntityName): Result<string, DataBackendError> {
  let version: number;
  try {
    version = getStoredVersion();
  } catch (error) {
    return migrationError("Could not read the local data migration version.", error);
  }

  if (version < LATEST_VERSION) {
    return migrationError(
      `Migration to v${LATEST_VERSION} is not active; refusing to resolve a key for "${entity}".`
    );
  }
  return { ok: true, data: versionedKeyName(entity, LATEST_VERSION) };
}

// Test-only escape hatch: resets in-memory module state to simulate a fresh
// page load/reload, where localStorage persists but all JS module state does
// not.
export function __resetMigrationStateForTests(): void {
  inFlight = null;
}
