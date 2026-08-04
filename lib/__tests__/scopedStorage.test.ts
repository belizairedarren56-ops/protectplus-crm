import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMigrationStateForTests, ensureLocalDataMigrated } from "@/lib/localDataMigrations";
import { resolveClientNotesKey, resolveStorageKey } from "@/lib/scopedStorage";
import type { AccessScope } from "@/hooks/useAccessScope";

const DEMO_SCOPE: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };
const SUPABASE_SCOPE: AccessScope = {
  status: "ready",
  backend: "supabase",
  agencyId: "agency-1",
  userId: "user-1",
  role: "producer",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: {} as any,
};

beforeEach(() => {
  window.localStorage.clear();
  __resetMigrationStateForTests();
});

describe("resolveClientNotesKey (correction 4.1.4)", () => {
  it("resolves to the unchanged legacy key text in demo mode — no migration needed", () => {
    // The whole point: String(42) and 42 produce identical key text, so the
    // pre-existing raw note under the legacy key is already valid.
    window.localStorage.setItem("protectplus-client-notes-42", "Call Friday about umbrella coverage");

    const result = resolveClientNotesKey("42", DEMO_SCOPE);
    expect(result).toEqual({ ok: true, data: "protectplus-client-notes-42" });
    expect(window.localStorage.getItem(result.ok ? result.data : "")).toBe(
      "Call Friday about umbrella coverage"
    );
  });

  it("resolves to a fully scope-and-client-scoped key in supabase mode", () => {
    const result = resolveClientNotesKey("client-uuid-1", SUPABASE_SCOPE);
    expect(result).toEqual({
      ok: true,
      data: "protectplus-supabase-mode-agency-1-user-1-producer-client-notes-client-uuid-1",
    });
  });

  it("fails with a typed not_ready error for a non-ready supabase scope", () => {
    const result = resolveClientNotesKey("1", { status: "loading", backend: "supabase" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_ready");
  });
});

describe("resolveStorageKey (correction 4.1.1)", () => {
  it("propagates a migration failure without falling back to the legacy key", async () => {
    // A fresh, empty localStorage isn't a failure case — migration trivially
    // (and correctly) succeeds with empty arrays for a brand-new install. To
    // actually exercise the propagation path, force a real verification
    // failure, the same way lib/__tests__/localDataMigrations.test.ts does.
    window.localStorage.setItem("protectplus-clients", "[]");
    window.localStorage.setItem("protectplus-leads", "[]");
    window.localStorage.setItem("protectplus-quotes", "[]");
    window.localStorage.setItem("protectplus-policies", "[]");
    window.localStorage.setItem("protectplus-tasks", "[]");
    window.localStorage.setItem("protectplus-documents", "[]");
    window.localStorage.setItem("protectplus-notifications", "[]");

    const originalGetItem = Storage.prototype.getItem;
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string
    ) {
      if (key === "protectplus-leads@v2") return JSON.stringify([{ corrupted: true }]);
      return originalGetItem.call(this, key);
    });

    const result = await resolveStorageKey("leads", DEMO_SCOPE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("migration");

    getItemSpy.mockRestore();
  });

  it("resolves the versioned key in demo mode once migration succeeds", async () => {
    window.localStorage.setItem("protectplus-clients", "[]");
    window.localStorage.setItem("protectplus-leads", "[]");
    window.localStorage.setItem("protectplus-quotes", "[]");
    window.localStorage.setItem("protectplus-policies", "[]");
    window.localStorage.setItem("protectplus-tasks", "[]");
    window.localStorage.setItem("protectplus-documents", "[]");
    window.localStorage.setItem("protectplus-notifications", "[]");
    await ensureLocalDataMigrated();

    const result = await resolveStorageKey("leads", DEMO_SCOPE);
    expect(result).toEqual({ ok: true, data: "protectplus-leads@v2" });
  });

  it("resolves a fully scoped namespace key in supabase mode, unrelated to versioning", async () => {
    const result = await resolveStorageKey("leads", SUPABASE_SCOPE);
    expect(result).toEqual({
      ok: true,
      data: "protectplus-supabase-mode-agency-1-user-1-producer-leads",
    });
  });

  it("fails with a typed not_ready error for a non-ready supabase scope", async () => {
    const result = await resolveStorageKey("leads", { status: "loading", backend: "supabase" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_ready");
  });
});
