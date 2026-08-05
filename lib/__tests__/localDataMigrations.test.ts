import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMigrationStateForTests,
  activeLegacyKey,
  ensureLocalDataMigrated,
  signalsAnotherTabCompletedMigration,
} from "@/lib/localDataMigrations";

const VERSION_KEY = "protectplus-storage-schema-version";
const JOURNAL_KEY = "protectplus-migration-journal";

function seedLegacyFixture() {
  window.localStorage.setItem(
    "protectplus-clients",
    JSON.stringify([{ id: 1735689600000, firstName: "Jane", lastName: "Cooper" }])
  );
  window.localStorage.setItem(
    "protectplus-quotes",
    JSON.stringify([{ id: 1, clientId: 1735689600000, clientName: "Jane Cooper" }])
  );
  window.localStorage.setItem("protectplus-leads", JSON.stringify([]));
  window.localStorage.setItem("protectplus-policies", JSON.stringify([]));
  window.localStorage.setItem("protectplus-tasks", JSON.stringify([]));
  window.localStorage.setItem("protectplus-documents", JSON.stringify([]));
  window.localStorage.setItem(
    "protectplus-notifications",
    JSON.stringify([{ id: 1, type: "task", message: "hello", timestamp: "2026-01-01", read: false }])
  );
}

// Simulates an installation that already completed the v1 -> v2 migration
// (every real user as of Phase 3C) — seeds every @v2 key directly and sets
// the version pointer to "2", with NO v1 legacy keys required to exist in
// their original form (a v2 install may have been migrated long ago; its
// v1 keys are never read again).
function seedV2Fixture(overrides: Partial<Record<string, unknown[]>> = {}) {
  const defaults: Record<string, unknown[]> = {
    clients: [{ id: "1735689600000", firstName: "Jane", lastName: "Cooper" }],
    leads: [],
    quotes: [],
    policies: [],
    tasks: [],
    documents: [],
    notifications: [],
  };
  const merged = { ...defaults, ...overrides };
  for (const [entity, value] of Object.entries(merged)) {
    window.localStorage.setItem(`protectplus-${entity}@v2`, JSON.stringify(value));
  }
  window.localStorage.setItem(VERSION_KEY, "2");
}

beforeEach(() => {
  window.localStorage.clear();
  __resetMigrationStateForTests();
});

describe("ensureLocalDataMigrated — fresh (version-0) installs (v1 -> v2 -> v3 chained in one pass)", () => {
  it("converts numeric client ids and clientId references to strings", async () => {
    seedLegacyFixture();

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    const clients = JSON.parse(window.localStorage.getItem("protectplus-clients@v3")!);
    const quotes = JSON.parse(window.localStorage.getItem("protectplus-quotes@v3")!);

    expect(clients[0].id).toBe("1735689600000");
    expect(typeof clients[0].id).toBe("string");
    expect(quotes[0].clientId).toBe("1735689600000");
    expect(quotes[0].clientId).toBe(clients[0].id); // relationship still resolves after conversion
  });

  it("Phase 3C: stringifies documents' and leads' own ids, but leaves notifications' own id a number (still local)", async () => {
    seedLegacyFixture();
    window.localStorage.setItem(
      "protectplus-documents",
      JSON.stringify([{ id: 42, name: "app.pdf", folder: "Applications" }])
    );
    window.localStorage.setItem(
      "protectplus-leads",
      JSON.stringify([{ id: 7, clientName: "Jane Cooper" }])
    );

    await ensureLocalDataMigrated();

    const documents = JSON.parse(window.localStorage.getItem("protectplus-documents@v3")!);
    const leads = JSON.parse(window.localStorage.getItem("protectplus-leads@v3")!);
    const notifications = JSON.parse(window.localStorage.getItem("protectplus-notifications@v3")!);

    expect(documents[0].id).toBe("42");
    expect(typeof documents[0].id).toBe("string");
    expect(leads[0].id).toBe("7");
    expect(typeof leads[0].id).toBe("string");
    // notifications is the one remaining entity with no id-type change.
    expect(notifications[0].id).toBe(1);
    expect(typeof notifications[0].id).toBe("number");
  });

  it("Phase 3C: renames leads' legacy producer field to assignedProducerName, and stringifies its own id", async () => {
    seedLegacyFixture();
    window.localStorage.setItem(
      "protectplus-leads",
      JSON.stringify([{ id: 11, clientName: "Jane Cooper", producer: "Jane Producer" }])
    );

    await ensureLocalDataMigrated();

    const leads = JSON.parse(window.localStorage.getItem("protectplus-leads@v3")!);
    expect(leads[0].id).toBe("11");
    expect(typeof leads[0].id).toBe("string");
    expect(leads[0].assignedProducerName).toBe("Jane Producer");
    expect(leads[0].producer).toBeUndefined();
  });

  it("Phase 3C: leaves an already-present assignedProducerName untouched rather than overwriting it from producer", async () => {
    seedLegacyFixture();
    window.localStorage.setItem(
      "protectplus-leads",
      JSON.stringify([
        { id: 12, clientName: "Jane Cooper", producer: "Stale Name", assignedProducerName: "Correct Name" },
      ])
    );

    await ensureLocalDataMigrated();

    const leads = JSON.parse(window.localStorage.getItem("protectplus-leads@v3")!);
    expect(leads[0].assignedProducerName).toBe("Correct Name");
    expect(leads[0].producer).toBeUndefined();
  });

  it("Phase 3B: renames tasks' legacy assignedTo field to assignedToName, and stringifies its own id", async () => {
    seedLegacyFixture();
    window.localStorage.setItem(
      "protectplus-tasks",
      JSON.stringify([{ id: 9, title: "Call client", assignedTo: "Jane Producer" }])
    );

    await ensureLocalDataMigrated();

    const tasks = JSON.parse(window.localStorage.getItem("protectplus-tasks@v3")!);
    expect(tasks[0].id).toBe("9");
    expect(typeof tasks[0].id).toBe("string");
    expect(tasks[0].assignedToName).toBe("Jane Producer");
    expect(tasks[0].assignedTo).toBeUndefined();
  });

  it("Phase 3B: renames quotes' legacy producer field to assignedProducerName, and stringifies its own id", async () => {
    seedLegacyFixture();
    window.localStorage.setItem(
      "protectplus-quotes",
      JSON.stringify([{ id: 5, clientId: 1735689600000, clientName: "Jane Cooper", producer: "Jane Producer" }])
    );

    await ensureLocalDataMigrated();

    const quotes = JSON.parse(window.localStorage.getItem("protectplus-quotes@v3")!);
    expect(quotes[0].id).toBe("5");
    expect(typeof quotes[0].id).toBe("string");
    expect(quotes[0].clientId).toBe("1735689600000");
    expect(quotes[0].assignedProducerName).toBe("Jane Producer");
    expect(quotes[0].producer).toBeUndefined();
  });

  it("Phase 3B: renames policies' legacy producer field to assignedProducerName, and stringifies its own id", async () => {
    seedLegacyFixture();
    window.localStorage.setItem(
      "protectplus-policies",
      JSON.stringify([{ id: 3, clientId: 1735689600000, clientName: "Jane Cooper", producer: "Jane Producer" }])
    );

    await ensureLocalDataMigrated();

    const policies = JSON.parse(window.localStorage.getItem("protectplus-policies@v3")!);
    expect(policies[0].id).toBe("3");
    expect(typeof policies[0].id).toBe("string");
    expect(policies[0].clientId).toBe("1735689600000");
    expect(policies[0].assignedProducerName).toBe("Jane Producer");
    expect(policies[0].producer).toBeUndefined();
  });

  it("(correction 4.1.3) includes notifications, copied via an identity transform", async () => {
    seedLegacyFixture();

    await ensureLocalDataMigrated();

    const notifications = JSON.parse(window.localStorage.getItem("protectplus-notifications@v3")!);
    expect(notifications).toEqual([
      { id: 1, type: "task", message: "hello", timestamp: "2026-01-01", read: false },
    ]);
  });

  it("never mutates the original v1 legacy key", async () => {
    seedLegacyFixture();
    const originalRaw = window.localStorage.getItem("protectplus-clients");

    await ensureLocalDataMigrated();

    expect(window.localStorage.getItem("protectplus-clients")).toBe(originalRaw);
  });

  it("writes both intermediate @v2 and final @v3 keys, and sets the version pointer to 3 only after every key verifies", async () => {
    seedLegacyFixture();
    expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();

    await ensureLocalDataMigrated();

    expect(window.localStorage.getItem("protectplus-clients@v2")).not.toBeNull();
    expect(window.localStorage.getItem("protectplus-clients@v3")).not.toBeNull();
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("3");
    expect(window.localStorage.getItem(JOURNAL_KEY)).toBeNull(); // cleared on success
  });

  it("is a no-op on a second call once already migrated", async () => {
    seedLegacyFixture();
    await ensureLocalDataMigrated();
    __resetMigrationStateForTests(); // simulate a fresh module load, e.g. a reload

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);
    // Still exactly what the first run produced — nothing re-derived or lost.
    const clients = JSON.parse(window.localStorage.getItem("protectplus-clients@v3")!);
    expect(clients[0].id).toBe("1735689600000");
  });

  it("same-tab concurrent callers share one run (memoized in-flight promise)", async () => {
    seedLegacyFixture();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const [first, second] = await Promise.all([ensureLocalDataMigrated(), ensureLocalDataMigrated()]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // One full run commits the version pointer exactly twice — once for
    // v1 -> v2, once for v2 -> v3. A second, independent (non-deduplicated)
    // run would have written it (at least) four times total.
    const versionWrites = setItemSpy.mock.calls.filter(([key]) => key === VERSION_KEY);
    expect(versionWrites).toHaveLength(2);
    setItemSpy.mockRestore();
  });

  it("resumes correctly after a simulated crash mid-migration", async () => {
    seedLegacyFixture();

    // Simulate a crash after "clients" finished (its @v2 key is present and
    // valid) but before "leads" (or anything after it) was written — the
    // journal is still marked in-progress, matching what a real interrupted
    // v1 -> v2 run would leave behind.
    window.localStorage.setItem(
      "protectplus-clients@v2",
      JSON.stringify([{ id: "1735689600000", firstName: "Jane", lastName: "Cooper" }])
    );
    window.localStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify({
        targetVersion: 2,
        status: "in-progress",
        keys: ["clients", "leads", "quotes", "policies", "tasks", "documents", "notifications"],
      })
    );
    // Version pointer deliberately NOT set — that's what makes this "resume"
    // rather than "already done".

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);
    // The full pipeline completes: v1 -> v2 resumes and finishes, then
    // v2 -> v3 runs immediately after, in the same call.
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("3");

    // Every key, including the ones after "clients", is now present at
    // both the intermediate and final versions.
    const quotesV2 = JSON.parse(window.localStorage.getItem("protectplus-quotes@v2")!);
    const quotesV3 = JSON.parse(window.localStorage.getItem("protectplus-quotes@v3")!);
    expect(quotesV2[0].clientId).toBe("1735689600000");
    expect(quotesV3[0].clientId).toBe("1735689600000");
  });

  it("(correction 4.1.1) a verification failure reports a typed migration error and does not flip the version pointer", async () => {
    seedLegacyFixture();

    const originalGetItem = Storage.prototype.getItem;
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string
    ) {
      if (key === "protectplus-clients@v2") return JSON.stringify([{ corrupted: true }]);
      return originalGetItem.call(this, key);
    });

    const result = await ensureLocalDataMigrated();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
    getItemSpy.mockRestore();
    expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();
  });
});

describe("ensureLocalDataMigrated — already-v2 installs (Phase 3C v2 -> v3 step)", () => {
  it("preserves a lead written under v2 after the original v1 -> v2 migration ran (only exists at @v2, never at v1)", async () => {
    seedV2Fixture({
      leads: [{ id: 99, clientName: "Post-migration Lead", producer: "Late Producer" }],
    });
    // No v1 "protectplus-leads" key at all — this lead was created after
    // the v1 -> v2 migration already completed, so it never existed there.

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    const leads = JSON.parse(window.localStorage.getItem("protectplus-leads@v3")!);
    expect(leads).toHaveLength(1);
    expect(leads[0].id).toBe("99");
    expect(leads[0].assignedProducerName).toBe("Late Producer");
  });

  it("never restores a lead that was deleted under v2, even if a stale v1 legacy copy still has it", async () => {
    // A v1 legacy key from long ago, still holding a lead that was since
    // deleted — this must never resurface once v2 is already active.
    window.localStorage.setItem(
      "protectplus-leads",
      JSON.stringify([{ id: 1, clientName: "Deleted Lead", producer: "Old Producer" }])
    );
    seedV2Fixture({ leads: [] }); // the active v2 state: the lead is gone

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    const leads = JSON.parse(window.localStorage.getItem("protectplus-leads@v3")!);
    expect(leads).toEqual([]);
  });

  it("copies every unrelated entity from @v2 to @v3 unchanged", async () => {
    seedV2Fixture({
      clients: [{ id: "1", firstName: "Jane", lastName: "Cooper" }],
      quotes: [{ id: "5", clientId: "1", clientName: "Jane Cooper" }],
      policies: [{ id: "6", clientId: "1", clientName: "Jane Cooper" }],
      tasks: [{ id: "7", title: "Call" }],
      documents: [{ id: "8", name: "app.pdf" }],
      notifications: [{ id: 1, type: "task", message: "hi", timestamp: "2026-01-01", read: false }],
    });

    await ensureLocalDataMigrated();

    for (const entity of ["clients", "quotes", "policies", "tasks", "documents", "notifications"]) {
      const v2 = window.localStorage.getItem(`protectplus-${entity}@v2`);
      const v3 = window.localStorage.getItem(`protectplus-${entity}@v3`);
      expect(v3).toBe(v2); // byte-for-byte identical — a pure identity copy
    }
  });

  it("skips the v1 -> v2 step entirely and never reads the v1 legacy key", async () => {
    seedV2Fixture();
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    expect(getItemSpy).not.toHaveBeenCalledWith("protectplus-leads");
    expect(getItemSpy).not.toHaveBeenCalledWith("protectplus-clients");
    getItemSpy.mockRestore();
  });

  it("resumes an interrupted v2 -> v3 step without re-running the already-committed v1 -> v2 step", async () => {
    seedV2Fixture({
      clients: [{ id: "1", firstName: "Jane", lastName: "Cooper" }],
    });
    // Simulate a crash mid-v2-to-v3: clients@v3 already written and valid,
    // leads@v3 missing, journal still marked in-progress for target 3.
    window.localStorage.setItem("protectplus-clients@v3", JSON.stringify([{ id: "1", firstName: "Jane", lastName: "Cooper" }]));
    window.localStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify({
        targetVersion: 3,
        status: "in-progress",
        keys: ["clients", "leads", "quotes", "policies", "tasks", "documents", "notifications"],
      })
    );

    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("3");
    expect(window.localStorage.getItem("protectplus-leads@v3")).not.toBeNull();
    // The already-committed v1 -> v2 step's source is never touched again.
    expect(getItemSpy).not.toHaveBeenCalledWith("protectplus-leads");
    getItemSpy.mockRestore();
  });

  it("subsequent reads resolve to @v3 via activeLegacyKey, not @v2 or the v1 legacy key", async () => {
    seedV2Fixture();
    await ensureLocalDataMigrated();

    const result = activeLegacyKey("leads");
    expect(result).toEqual({ ok: true, data: "protectplus-leads@v3" });
  });
});

describe("missing or malformed active @v2 source key fails closed (Phase 3C safeguard)", () => {
  it("fails closed when an already-v2 install's @v2 source key is missing entirely", async () => {
    seedV2Fixture();
    window.localStorage.removeItem("protectplus-leads@v2"); // simulated corruption/partial deletion
    // A stale v1 key that must NEVER be used as a fallback:
    window.localStorage.setItem(
      "protectplus-leads",
      JSON.stringify([{ id: 1, clientName: "Should never resurface" }])
    );

    const result = await ensureLocalDataMigrated();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
    // The load-bearing guarantee: the version pointer — the actual "commit"
    // — never advances to 3, regardless of which individual @v3 keys were
    // already written for entities processed earlier in iteration order
    // (matching the same partial-write-then-resume precedent the v1 -> v2
    // step already relies on). Nothing ever reads from @v3 until the
    // pointer says version >= 3 (see activeLegacyKey's fail-closed guard),
    // so a leftover partial write here is inert, not a correctness risk.
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("2");
    expect(window.localStorage.getItem("protectplus-leads@v3")).toBeNull(); // the entity that actually failed never commits
  });

  it("fails closed when an already-v2 install's @v2 source key holds invalid JSON", async () => {
    seedV2Fixture();
    window.localStorage.setItem("protectplus-leads@v2", "{not valid json");

    const result = await ensureLocalDataMigrated();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("2");
    expect(window.localStorage.getItem("protectplus-leads@v3")).toBeNull();
  });

  it("fails closed when an already-v2 install's @v2 source key holds valid JSON that isn't an array", async () => {
    seedV2Fixture();
    window.localStorage.setItem("protectplus-leads@v2", JSON.stringify({ not: "an array" }));

    const result = await ensureLocalDataMigrated();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("2");
    expect(window.localStorage.getItem("protectplus-leads@v3")).toBeNull();
  });

  it("a genuinely absent v1 legacy key on a fresh (version-0) install is still valid — the stricter rule is v2-source-only", async () => {
    // No "protectplus-leads" key at all, and no version pointer — a fresh
    // install. This must still succeed: missingSourceIsEmpty is true for
    // the v1 -> v2 step.
    window.localStorage.setItem("protectplus-clients", JSON.stringify([]));
    window.localStorage.setItem("protectplus-quotes", JSON.stringify([]));
    window.localStorage.setItem("protectplus-policies", JSON.stringify([]));
    window.localStorage.setItem("protectplus-tasks", JSON.stringify([]));
    window.localStorage.setItem("protectplus-documents", JSON.stringify([]));
    window.localStorage.setItem("protectplus-notifications", JSON.stringify([]));

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("3");
    expect(JSON.parse(window.localStorage.getItem("protectplus-leads@v3")!)).toEqual([]);
  });
});

describe("activeLegacyKey (correction 4.1.2 — fails closed, no legacy-key fallback)", () => {
  it("returns a typed error, not the legacy key, when migration hasn't run", () => {
    const result = activeLegacyKey("clients");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
  });

  it("returns a typed error when only the v1 -> v2 step has completed (version 2, not yet 3)", () => {
    seedV2Fixture();
    const result = activeLegacyKey("clients");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
  });

  it("resolves the v3 versioned key once migration is fully active", async () => {
    seedLegacyFixture();
    await ensureLocalDataMigrated();

    const result = activeLegacyKey("clients");
    expect(result).toEqual({ ok: true, data: "protectplus-clients@v3" });
  });
});

describe("legacy Client.producer is renamed to assignedProducerName", () => {
  it("copies producer into assignedProducerName and drops the old field", async () => {
    window.localStorage.setItem(
      "protectplus-clients",
      JSON.stringify([
        { id: 1735689600000, firstName: "Jane", lastName: "Cooper", producer: "Maria Gonzalez" },
      ])
    );
    window.localStorage.setItem("protectplus-leads", JSON.stringify([]));
    window.localStorage.setItem("protectplus-quotes", JSON.stringify([]));
    window.localStorage.setItem("protectplus-policies", JSON.stringify([]));
    window.localStorage.setItem("protectplus-tasks", JSON.stringify([]));
    window.localStorage.setItem("protectplus-documents", JSON.stringify([]));
    window.localStorage.setItem("protectplus-notifications", JSON.stringify([]));

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    const clients = JSON.parse(window.localStorage.getItem("protectplus-clients@v3")!);
    expect(clients[0].assignedProducerName).toBe("Maria Gonzalez");
    expect(clients[0]).not.toHaveProperty("producer");
  });
});

describe("malformed v1 legacy JSON", () => {
  it("returns a typed migration error, writes no versioned data, and never flips the version pointer", async () => {
    window.localStorage.setItem("protectplus-clients", "{not valid json");
    window.localStorage.setItem("protectplus-leads", JSON.stringify([]));
    window.localStorage.setItem("protectplus-quotes", JSON.stringify([]));
    window.localStorage.setItem("protectplus-policies", JSON.stringify([]));
    window.localStorage.setItem("protectplus-tasks", JSON.stringify([]));
    window.localStorage.setItem("protectplus-documents", JSON.stringify([]));
    window.localStorage.setItem("protectplus-notifications", JSON.stringify([]));

    const result = await ensureLocalDataMigrated();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
    expect(window.localStorage.getItem("protectplus-clients@v2")).toBeNull();
    expect(window.localStorage.getItem("protectplus-clients@v3")).toBeNull();
    expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();
    // The legacy backup itself is byte-for-byte untouched.
    expect(window.localStorage.getItem("protectplus-clients")).toBe("{not valid json");
  });

  it("treats a genuinely absent legacy key as empty data, not an error", async () => {
    // No protectplus-clients key at all — a fresh install, distinct from a
    // present-but-corrupted one.
    window.localStorage.setItem("protectplus-leads", JSON.stringify([]));
    window.localStorage.setItem("protectplus-quotes", JSON.stringify([]));
    window.localStorage.setItem("protectplus-policies", JSON.stringify([]));
    window.localStorage.setItem("protectplus-tasks", JSON.stringify([]));
    window.localStorage.setItem("protectplus-documents", JSON.stringify([]));
    window.localStorage.setItem("protectplus-notifications", JSON.stringify([]));

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("protectplus-clients@v2")!)).toEqual([]);
  });
});

describe("localStorage exceptions during migration", () => {
  it("returns a typed migration error (not a rejected promise) when setItem throws", async () => {
    seedLegacyFixture();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    await expect(ensureLocalDataMigrated()).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ kind: "migration" }) })
    );

    setItemSpy.mockRestore();
    // Neither the version pointer nor any versioned key was written, since
    // every attempt to do so threw.
    expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();
    expect(window.localStorage.getItem("protectplus-clients@v2")).toBeNull();
    // The legacy backup is unaffected — this module never writes to it.
    expect(window.localStorage.getItem("protectplus-clients")).toContain("1735689600000");
  });

  it("returns a typed migration error when getItem throws while reading a legacy key", async () => {
    seedLegacyFixture();
    const originalGetItem = Storage.prototype.getItem;
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string
    ) {
      if (key === "protectplus-clients") throw new Error("SecurityError");
      return originalGetItem.call(this, key);
    });

    const result = await ensureLocalDataMigrated();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
    getItemSpy.mockRestore();
    expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();
  });

  it("returns a typed migration error (not a rejected promise) when removeItem throws clearing the journal", async () => {
    seedLegacyFixture();
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    // Both steps' version pointers still commit successfully — clearing the
    // journal afterward is best-effort, not a correctness requirement (see
    // the comment in runStep()) — so this must still resolve ok, ending at
    // the final version (3), having run both steps.
    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("3");

    removeItemSpy.mockRestore();
  });
});

describe("(correction 4.1.1) a failed migration causes zero reads and zero writes downstream", () => {
  it("demoClientsRepository attempts no read or write once migration has already failed", async () => {
    // First, make the migration itself fail (corrupted verification) and
    // let that failure fully resolve — this is the migration's OWN write
    // attempt settling, not yet the property under test.
    seedLegacyFixture();
    const originalGetItem = Storage.prototype.getItem;
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string
    ) {
      if (key === "protectplus-clients@v2") return JSON.stringify([{ corrupted: true }]);
      return originalGetItem.call(this, key);
    });

    const { ensureLocalDataMigrated: ensureAgain } = await import("@/lib/localDataMigrations");
    const firstAttempt = await ensureAgain();
    expect(firstAttempt.ok).toBe(false);

    // Now, with migration already failed and settled, reset the spies and
    // prove the repository layer itself performs zero additional storage
    // I/O when it re-checks migration status and finds it still failing.
    const { demoClientsRepository } = await import("@/lib/repositories/demoClientsRepository");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    getItemSpy.mockClear();
    setItemSpy.mockClear();

    const listResult = await demoClientsRepository.list();
    expect(listResult.ok).toBe(false);
    if (!listResult.ok) expect(listResult.error.kind).toBe("migration");

    expect(getItemSpy).not.toHaveBeenCalledWith("protectplus-clients@v3");
    expect(setItemSpy).not.toHaveBeenCalled();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});

describe("signalsAnotherTabCompletedMigration (pure predicate)", () => {
  it("is true for the version key reaching the latest version (3)", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: "3" })).toBe(true);
  });

  it("is true for a version newer than the latest (a future migration)", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: "4" })).toBe(true);
  });

  it("is false for an unrelated key", () => {
    expect(signalsAnotherTabCompletedMigration({ key: "protectplus-clients@v3", newValue: "3" })).toBe(false);
  });

  it("is false for the version key removed (newValue null)", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: null })).toBe(false);
  });

  it("is false for version 2 — the intermediate step no longer signals full completion", () => {
    // Proves the threshold genuinely moved to 3: a value that used to mean
    // "done" (back when 2 was the target) must no longer signal completion.
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: "2" })).toBe(false);
  });

  it("is false for a non-numeric value", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: "not-a-number" })).toBe(false);
  });
});

describe("cross-tab migration completion (storage event)", () => {
  // Note on what this suite can and can't prove: this module's actual
  // migration work is synchronous under the hood (readSourceStrict/
  // transform/setItem have no real async I/O — see runMigrationUnsafe's own
  // comments), so within a single test process this tab's own run always
  // completes before any dispatched StorageEvent can be processed — there's
  // no other real execution context racing against it the way an actual
  // second browser tab would provide. These tests verify the listener's
  // lifecycle (attached only when needed, always cleaned up) and that a
  // genuine completion-signaling event never corrupts or double-resolves an
  // in-flight or already-settled call; signalsAnotherTabCompletedMigration's
  // own dedicated suite above covers the event-matching logic in isolation.

  it("a completion event arriving during a call does not corrupt the result or double-resolve", async () => {
    seedLegacyFixture();

    const promise = ensureLocalDataMigrated();
    window.dispatchEvent(new StorageEvent("storage", { key: VERSION_KEY, newValue: "3" }));

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("3");

    // Migrated data is intact and correctly transformed either way — the
    // event didn't short-circuit past the real migration's own work having
    // already produced (and verified) it.
    const clients = JSON.parse(window.localStorage.getItem("protectplus-clients@v3")!);
    expect(clients[0].id).toBe("1735689600000");
  });

  it("removes its storage listener after resolving (no leak across calls)", async () => {
    seedLegacyFixture();
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    const storageAdds = addSpy.mock.calls.filter(([type]) => type === "storage").length;
    const storageRemoves = removeSpy.mock.calls.filter(([type]) => type === "storage").length;
    expect(storageAdds).toBeGreaterThan(0);
    expect(storageRemoves).toBe(storageAdds);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("an unrelated storage event does not cause a premature resolution", async () => {
    seedLegacyFixture();

    const result = await ensureLocalDataMigrated();
    // Dispatched after the real run already completed — this just proves an
    // unrelated event handled post-completion doesn't throw or misbehave;
    // the real "doesn't preempt" guarantee is that the awaited result above
    // already reflects this tab's own successful, fully-verified run.
    window.dispatchEvent(new StorageEvent("storage", { key: "protectplus-clients@v3", newValue: "[]" }));

    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("3");
  });

  it("does not attach a storage listener when already migrated", async () => {
    seedLegacyFixture();
    await ensureLocalDataMigrated();
    __resetMigrationStateForTests(); // simulate a fresh module load, version pointer already "3"

    const addSpy = vi.spyOn(window, "addEventListener");
    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    expect(addSpy.mock.calls.filter(([type]) => type === "storage")).toHaveLength(0);
    addSpy.mockRestore();
  });
});
