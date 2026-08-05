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

beforeEach(() => {
  window.localStorage.clear();
  __resetMigrationStateForTests();
});

describe("ensureLocalDataMigrated", () => {
  it("converts numeric client ids and clientId references to strings", async () => {
    seedLegacyFixture();

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    const clients = JSON.parse(window.localStorage.getItem("protectplus-clients@v2")!);
    const quotes = JSON.parse(window.localStorage.getItem("protectplus-quotes@v2")!);

    expect(clients[0].id).toBe("1735689600000");
    expect(typeof clients[0].id).toBe("string");
    expect(quotes[0].clientId).toBe("1735689600000");
    expect(quotes[0].clientId).toBe(clients[0].id); // relationship still resolves after conversion
  });

  it("Phase 3B: stringifies documents' own id (Supabase-backed), but leaves leads' own id a number (still local)", async () => {
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

    const documents = JSON.parse(window.localStorage.getItem("protectplus-documents@v2")!);
    const leads = JSON.parse(window.localStorage.getItem("protectplus-leads@v2")!);

    expect(documents[0].id).toBe("42");
    expect(typeof documents[0].id).toBe("string");
    // leads isn't migrated until Phase 3C — its own id must stay a number,
    // matching the still-unchanged Lead.id: number type.
    expect(leads[0].id).toBe(7);
    expect(typeof leads[0].id).toBe("number");
  });

  it("Phase 3B: renames tasks' legacy assignedTo field to assignedToName, and stringifies its own id", async () => {
    seedLegacyFixture();
    window.localStorage.setItem(
      "protectplus-tasks",
      JSON.stringify([{ id: 9, title: "Call client", assignedTo: "Jane Producer" }])
    );

    await ensureLocalDataMigrated();

    const tasks = JSON.parse(window.localStorage.getItem("protectplus-tasks@v2")!);
    expect(tasks[0].id).toBe("9");
    expect(typeof tasks[0].id).toBe("string");
    expect(tasks[0].assignedToName).toBe("Jane Producer");
    expect(tasks[0].assignedTo).toBeUndefined();
  });

  it("(correction 4.1.3) includes notifications, copied via an identity transform", async () => {
    seedLegacyFixture();

    await ensureLocalDataMigrated();

    const notifications = JSON.parse(window.localStorage.getItem("protectplus-notifications@v2")!);
    expect(notifications).toEqual([
      { id: 1, type: "task", message: "hello", timestamp: "2026-01-01", read: false },
    ]);
  });

  it("never mutates the original legacy key", async () => {
    seedLegacyFixture();
    const originalRaw = window.localStorage.getItem("protectplus-clients");

    await ensureLocalDataMigrated();

    expect(window.localStorage.getItem("protectplus-clients")).toBe(originalRaw);
  });

  it("sets the version pointer only after every key verifies", async () => {
    seedLegacyFixture();
    expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();

    await ensureLocalDataMigrated();

    expect(window.localStorage.getItem(VERSION_KEY)).toBe("2");
    expect(window.localStorage.getItem(JOURNAL_KEY)).toBeNull(); // cleared on success
  });

  it("is a no-op on a second call once already migrated", async () => {
    seedLegacyFixture();
    await ensureLocalDataMigrated();
    __resetMigrationStateForTests(); // simulate a fresh module load, e.g. a reload

    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);
    // Still exactly what the first run produced — nothing re-derived or lost.
    const clients = JSON.parse(window.localStorage.getItem("protectplus-clients@v2")!);
    expect(clients[0].id).toBe("1735689600000");
  });

  it("same-tab concurrent callers share one run (memoized in-flight promise)", async () => {
    seedLegacyFixture();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const [first, second] = await Promise.all([ensureLocalDataMigrated(), ensureLocalDataMigrated()]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // The version pointer is written exactly once — a second, independent
    // run would have written it (at least) twice.
    const versionWrites = setItemSpy.mock.calls.filter(([key]) => key === VERSION_KEY);
    expect(versionWrites).toHaveLength(1);
    setItemSpy.mockRestore();
  });

  it("resumes correctly after a simulated crash mid-migration", async () => {
    seedLegacyFixture();

    // Simulate a crash after "clients" finished (its @v2 key is present and
    // valid) but before "leads" (or anything after it) was written — the
    // journal is still marked in-progress, matching what a real interrupted
    // run would leave behind.
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
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("2");

    // Every key, including the ones after "clients", is now present.
    const quotes = JSON.parse(window.localStorage.getItem("protectplus-quotes@v2")!);
    expect(quotes[0].clientId).toBe("1735689600000");
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

describe("activeLegacyKey (correction 4.1.2 — fails closed, no legacy-key fallback)", () => {
  it("returns a typed error, not the legacy key, when migration hasn't run", () => {
    const result = activeLegacyKey("clients");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");
  });

  it("resolves the versioned key once migration is active", async () => {
    seedLegacyFixture();
    await ensureLocalDataMigrated();

    const result = activeLegacyKey("clients");
    expect(result).toEqual({ ok: true, data: "protectplus-clients@v2" });
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

    const clients = JSON.parse(window.localStorage.getItem("protectplus-clients@v2")!);
    expect(clients[0].assignedProducerName).toBe("Maria Gonzalez");
    expect(clients[0]).not.toHaveProperty("producer");
  });
});

describe("malformed legacy JSON", () => {
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

    // The version pointer still commits successfully — clearing the journal
    // afterward is best-effort, not a correctness requirement (see the
    // comment in runMigrationUnsafe()) — so this must still resolve ok.
    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("2");

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

    expect(getItemSpy).not.toHaveBeenCalledWith("protectplus-clients@v2");
    expect(setItemSpy).not.toHaveBeenCalled();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});

describe("signalsAnotherTabCompletedMigration (pure predicate)", () => {
  it("is true for the version key reaching the target version", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: "2" })).toBe(true);
  });

  it("is true for a version newer than the target (a future migration)", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: "3" })).toBe(true);
  });

  it("is false for an unrelated key", () => {
    expect(signalsAnotherTabCompletedMigration({ key: "protectplus-clients@v2", newValue: "2" })).toBe(false);
  });

  it("is false for the version key removed (newValue null)", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: null })).toBe(false);
  });

  it("is false for a version below the target", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: "1" })).toBe(false);
  });

  it("is false for a non-numeric value", () => {
    expect(signalsAnotherTabCompletedMigration({ key: VERSION_KEY, newValue: "not-a-number" })).toBe(false);
  });
});

describe("cross-tab migration completion (storage event)", () => {
  // Note on what this suite can and can't prove: this module's actual
  // migration work is synchronous under the hood (readLegacyStrict/
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
    window.dispatchEvent(new StorageEvent("storage", { key: VERSION_KEY, newValue: "2" }));

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("2");

    // Migrated data is intact and correctly transformed either way — the
    // event didn't short-circuit past the real migration's own work having
    // already produced (and verified) it.
    const clients = JSON.parse(window.localStorage.getItem("protectplus-clients@v2")!);
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
    window.dispatchEvent(new StorageEvent("storage", { key: "protectplus-clients@v2", newValue: "[]" }));

    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe("2");
  });

  it("does not attach a storage listener when already migrated", async () => {
    seedLegacyFixture();
    await ensureLocalDataMigrated();
    __resetMigrationStateForTests(); // simulate a fresh module load, version pointer already "2"

    const addSpy = vi.spyOn(window, "addEventListener");
    const result = await ensureLocalDataMigrated();
    expect(result.ok).toBe(true);

    expect(addSpy.mock.calls.filter(([type]) => type === "storage")).toHaveLength(0);
    addSpy.mockRestore();
  });
});
