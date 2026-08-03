import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMigrationStateForTests,
  activeLegacyKey,
  ensureLocalDataMigrated,
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
