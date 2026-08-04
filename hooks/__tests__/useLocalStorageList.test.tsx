import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import type { AccessScope } from "@/hooks/useAccessScope";

const SCOPE_A: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };
const SCOPE_B: AccessScope = {
  status: "ready",
  backend: "supabase",
  agencyId: "agency-b",
  userId: "user-b",
  role: "producer",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: {} as any,
};

type Item = { id: string; label: string };

beforeEach(() => {
  window.localStorage.clear();
  __resetMigrationStateForTests();
});

describe("useLocalStorageList", () => {
  it("no save fires before async key resolution and initial load complete", async () => {
    // Real, pre-existing data — if the persistence effect fired before
    // `loaded`, it would clobber this with the hook's not-yet-loaded `[]`
    // initial state. (Note: the migration gate's own copy-forward writes
    // are synchronous in this test environment since it has no real async
    // I/O internally — that's a separate, legitimate write, not the
    // property under test here.)
    window.localStorage.setItem("protectplus-leads", JSON.stringify([{ id: "1", label: "Existing" }]));

    const { result } = renderHook(() => useLocalStorageList<Item>("leads", SCOPE_A));

    const versionedRaw = window.localStorage.getItem("protectplus-leads@v2");
    if (versionedRaw) {
      expect(JSON.parse(versionedRaw)).not.toEqual([]);
    }

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.items).toEqual([{ id: "1", label: "Existing" }]);
  });

  it("loads seeded data once resolution completes", async () => {
    window.localStorage.setItem("protectplus-leads", JSON.stringify([{ id: "1", label: "Existing" }]));

    const { result } = renderHook(() => useLocalStorageList<Item>("leads", SCOPE_A));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.items).toEqual([{ id: "1", label: "Existing" }]);
  });

  it("(correction 4.2.2) a direct rerender from scope A to scope B never shows scope A's data, not even for one render", async () => {
    window.localStorage.setItem("protectplus-leads", JSON.stringify([{ id: "1", label: "Scope A item" }]));

    const { result, rerender } = renderHook(
      ({ scope }: { scope: AccessScope }) => useLocalStorageList<Item>("leads", scope),
      { initialProps: { scope: SCOPE_A } as { scope: AccessScope } }
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.items).toEqual([{ id: "1", label: "Scope A item" }]);

    rerender({ scope: SCOPE_B });

    // Immediately after the rerender call — before any effect has had a
    // chance to flush — the render-time fingerprint guard must already have
    // reset to the not-loaded, empty state. This is the whole point of
    // adjusting state during render rather than in an effect.
    expect(result.current.items).toEqual([]);
    expect(result.current.loaded).toBe(false);
  });

  it("switching scope cannot write the previous scope's data under the new scope's key", async () => {
    window.localStorage.setItem("protectplus-leads", JSON.stringify([{ id: "1", label: "Scope A item" }]));

    const { result, rerender } = renderHook(
      ({ scope }: { scope: AccessScope }) => useLocalStorageList<Item>("leads", scope),
      { initialProps: { scope: SCOPE_A } as { scope: AccessScope } }
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      rerender({ scope: SCOPE_B });
    });

    // Give scope B's own (not-ready-repository-backed) resolution a chance
    // to settle — it should end in an error state (not_ready is irrelevant
    // here since SCOPE_B is "ready"; the scoped namespace key is what it
    // resolves to), never scope A's content.
    await waitFor(() => expect(result.current.loaded || result.current.error !== null).toBe(true));

    const scopeBKey =
      "protectplus-supabase-mode-agency-b-user-b-producer-leads";
    const scopeBStored = window.localStorage.getItem(scopeBKey);
    if (scopeBStored) {
      expect(JSON.parse(scopeBStored)).not.toEqual([{ id: "1", label: "Scope A item" }]);
    }
    // Scope A's own key is untouched by anything that happened after the switch.
    expect(JSON.parse(window.localStorage.getItem("protectplus-leads")!)).toEqual([
      { id: "1", label: "Scope A item" },
    ]);
  });
});
