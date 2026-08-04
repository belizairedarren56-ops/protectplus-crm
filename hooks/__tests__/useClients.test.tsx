import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { useClients } from "@/hooks/useClients";
import { AccessScopeContext, type AccessScope } from "@/hooks/useAccessScope";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import { createTestQueryClient } from "@/test-utils/renderWithProviders";
import type { ReactNode } from "react";

function wrapperFor(scope: AccessScope) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = createTestQueryClient();
    return (
      <QueryClientProvider client={queryClient}>
        <AccessScopeContext.Provider value={scope}>{children}</AccessScopeContext.Provider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  window.localStorage.clear();
  __resetMigrationStateForTests();
});

describe("useClients — correction 4.1.1 (not-ready scope guard)", () => {
  it("attempts no read while the scope is loading", async () => {
    const { result } = renderHook(() => useClients(), {
      wrapper: wrapperFor({ status: "loading", backend: "supabase" }),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.clients).toEqual([]);
  });

  it("createClient returns a typed not_ready error and writes nothing while unauthenticated", async () => {
    const { result } = renderHook(() => useClients(), {
      wrapper: wrapperFor({ status: "unauthenticated", backend: "supabase" }),
    });

    let outcome: Awaited<ReturnType<typeof result.current.createClient>> | undefined;
    await act(async () => {
      outcome = await result.current.createClient({
        firstName: "Jane",
        lastName: "Doe",
        phone: "",
        email: "",
        policyType: "Auto",
        status: "New Lead",
      });
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe("not_ready");
  });

  it("archiveClient returns a typed not_ready error while the scope has errored", async () => {
    const { result } = renderHook(() => useClients(), {
      wrapper: wrapperFor({
        status: "error",
        backend: "supabase",
        error: { kind: "unknown", message: "boom" },
      }),
    });

    let outcome: Awaited<ReturnType<typeof result.current.archiveClient>> | undefined;
    await act(async () => {
      outcome = await result.current.archiveClient("some-id");
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe("not_ready");
    expect(result.current.isError).toBe(true);
  });

  it("demo mode: list resolves successfully with an empty array by default", async () => {
    const { result } = renderHook(() => useClients(), {
      wrapper: wrapperFor({ status: "ready", backend: "demo", agencyId: null, userId: null, role: null }),
    });

    await waitFor(() => expect(result.current.clientsLoaded).toBe(true));
    expect(result.current.clients).toEqual([]);
    expect(result.current.isError).toBe(false);
  });
});
