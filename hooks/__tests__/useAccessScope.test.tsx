import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessScopeProvider, SupabaseClientProvider } from "@/app/AccessScopeProvider";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { Database } from "@/lib/supabase/database.types";
import { createTestQueryClient } from "@/test-utils/renderWithProviders";

vi.mock("next/navigation", () => ({
  usePathname: () => "/clients",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

type ProfileRow = { agency_id: string; role: "admin" | "producer" };
type AuthSession = { user: { id: string } } | null;
type AuthCallback = (event: string, session: AuthSession) => unknown;

// A mock Supabase client whose onAuthStateChange callback is captured so the
// test can invoke it directly (simulating real auth events) and whose
// `profiles` lookup is backed by a mutable map, so a test can change what a
// given user's profile resolves to (simulating a role change) and force a
// refetch without needing a new auth event at all.
function createMockSupabaseClient(profiles: Record<string, ProfileRow>) {
  let authCallback: AuthCallback | null = null;
  const unsubscribe = vi.fn();

  const client = {
    auth: {
      onAuthStateChange: (callback: AuthCallback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe } } };
      },
    },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: (_column: string, userId: string) => ({
            single: async () => {
              const row = profiles[userId];
              if (!row) return { data: null, error: { message: `no profile for ${userId}` } };
              return { data: row, error: null };
            },
          }),
        }),
      };
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    // Returns whatever the real callback returns — used to prove it's
    // synchronous (never a Promise) rather than asserting on internals.
    fireAuthEvent: (event: string, userId: string | null): unknown => {
      if (!authCallback) throw new Error("onAuthStateChange callback not registered yet");
      return authCallback(event, userId ? { user: { id: userId } } : null);
    },
    unsubscribe,
  };
}

let renders: AccessScope[] = [];

function Probe() {
  const scope = useAccessScope();
  renders.push(scope);
  return <div data-testid="status">{scope.status}</div>;
}

function renderScope(client: SupabaseClient<Database>, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SupabaseClientProvider value={client}>
        <AccessScopeProvider backend="supabase">
          <Probe />
        </AccessScopeProvider>
      </SupabaseClientProvider>
    </QueryClientProvider>
  );
}

function readyScopesFor(userId: string) {
  return renders.filter(
    (s): s is Extract<AccessScope, { status: "ready"; backend: "supabase" }> =>
      s.status === "ready" && s.backend === "supabase" && s.userId === userId
  );
}

beforeEach(() => {
  renders = [];
});

describe("useAccessScope / AccessScopeProvider — cache clearing and render sequencing", () => {
  it("SIGNED_OUT clears the query cache", async () => {
    const mock = createMockSupabaseClient({ u1: { agency_id: "a1", role: "producer" } });
    const queryClient = createTestQueryClient();
    renderScope(mock.client, queryClient);

    act(() => mock.fireAuthEvent("INITIAL_SESSION", "u1"));
    await waitFor(() => expect(readyScopesFor("u1").length).toBeGreaterThan(0));

    queryClient.setQueryData(["dummy"], "should-be-cleared-on-sign-out");
    expect(queryClient.getQueryData(["dummy"])).toBe("should-be-cleared-on-sign-out");

    // UnauthenticatedGate unmounts Probe once scope becomes "unauthenticated"
    // (on a protected route, correctly hiding content) — so the query cache
    // itself, not a later Probe render, is the only observable proof the
    // clear happened.
    act(() => mock.fireAuthEvent("SIGNED_OUT", null));
    await waitFor(() => expect(queryClient.getQueryData(["dummy"])).toBeUndefined());
  });

  it("a same-tab user-id change clears the query cache", async () => {
    const mock = createMockSupabaseClient({
      u1: { agency_id: "a1", role: "producer" },
      u2: { agency_id: "a2", role: "admin" },
    });
    const queryClient = createTestQueryClient();
    renderScope(mock.client, queryClient);

    act(() => mock.fireAuthEvent("INITIAL_SESSION", "u1"));
    await waitFor(() => expect(readyScopesFor("u1").length).toBeGreaterThan(0));

    queryClient.setQueryData(["dummy"], "should-be-cleared-on-user-change");

    act(() => mock.fireAuthEvent("SIGNED_IN", "u2"));
    await waitFor(() => expect(readyScopesFor("u2").length).toBeGreaterThan(0));

    expect(queryClient.getQueryData(["dummy"])).toBeUndefined();
  });

  it("a same-user role change (picked up on refetch) clears the query cache", async () => {
    const profiles: Record<string, ProfileRow> = { u1: { agency_id: "a1", role: "producer" } };
    const mock = createMockSupabaseClient(profiles);
    const queryClient = createTestQueryClient();
    renderScope(mock.client, queryClient);

    act(() => mock.fireAuthEvent("INITIAL_SESSION", "u1"));
    await waitFor(() => {
      const ready = readyScopesFor("u1");
      expect(ready.some((s) => s.role === "producer")).toBe(true);
    });

    queryClient.setQueryData(["dummy"], "should-be-cleared-on-role-change");

    // No new auth event — an admin changed this user's role server-side,
    // and the profile query picks it up on its next refetch (window
    // refocus, reconnect, next mount — simulated directly here).
    profiles.u1 = { agency_id: "a1", role: "admin" };
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["own-profile", "u1"] });
    });

    await waitFor(() => {
      const ready = readyScopesFor("u1");
      expect(ready.some((s) => s.role === "admin")).toBe(true);
    });

    expect(queryClient.getQueryData(["dummy"])).toBeUndefined();
  });

  it("no intermediate render exposes a ready scope mixing the old and new identity's fields", async () => {
    const mock = createMockSupabaseClient({
      u1: { agency_id: "a1", role: "producer" },
      u2: { agency_id: "a2", role: "admin" },
    });
    const queryClient = createTestQueryClient();
    renderScope(mock.client, queryClient);

    act(() => mock.fireAuthEvent("INITIAL_SESSION", "u1"));
    await waitFor(() => expect(readyScopesFor("u1").length).toBeGreaterThan(0));

    act(() => mock.fireAuthEvent("SIGNED_IN", "u2"));
    await waitFor(() => expect(readyScopesFor("u2").length).toBeGreaterThan(0));

    // Every "ready" render, from the very first to the very last, must
    // fully match one identity or the other — never a hybrid (e.g. the new
    // userId paired with the old agencyId/role).
    const readyRenders = renders.filter(
      (s): s is Extract<AccessScope, { status: "ready"; backend: "supabase" }> =>
        s.status === "ready" && s.backend === "supabase"
    );
    for (const scope of readyRenders) {
      const matchesOld = scope.userId === "u1" && scope.agencyId === "a1" && scope.role === "producer";
      const matchesNew = scope.userId === "u2" && scope.agencyId === "a2" && scope.role === "admin";
      expect(matchesOld || matchesNew).toBe(true);
    }

    // And the transition genuinely passed through "loading" — proving this
    // wasn't a direct jump from one ready identity straight to another with
    // no intermediate state at all.
    const firstOldReady = renders.findIndex((s) => s.status === "ready" && s.backend === "supabase" && s.userId === "u1");
    const firstNewReady = renders.findIndex((s) => s.status === "ready" && s.backend === "supabase" && s.userId === "u2");
    expect(firstOldReady).toBeGreaterThanOrEqual(0);
    expect(firstNewReady).toBeGreaterThan(firstOldReady);

    const between = renders.slice(firstOldReady + 1, firstNewReady);
    expect(between.length).toBeGreaterThan(0);
    expect(between.every((s) => s.status === "loading")).toBe(true);
  });

  it("the onAuthStateChange callback is synchronous — never returns a promise", async () => {
    const mock = createMockSupabaseClient({ u1: { agency_id: "a1", role: "producer" } });
    const queryClient = createTestQueryClient();
    renderScope(mock.client, queryClient);

    let returnValue: unknown;
    act(() => {
      returnValue = mock.fireAuthEvent("INITIAL_SESSION", "u1");
    });
    // A function that awaits anything internally is an async function and
    // always returns a Promise, even if the caller ignores it — asserting
    // `undefined` here is only possible because the real callback contains
    // no await at all, matching Supabase's own guidance against calling
    // other async client methods from inside this listener.
    expect(returnValue).toBeUndefined();

    await waitFor(() => expect(readyScopesFor("u1").length).toBeGreaterThan(0));
  });
});
