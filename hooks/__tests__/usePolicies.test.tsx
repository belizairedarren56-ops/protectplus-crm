import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { usePolicies } from "@/hooks/usePolicies";
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

function baseInput() {
  return {
    clientId: "client-1",
    clientName: "Jane Cooper",
    carrier: "State Farm",
    policyNumber: "SF-1000000",
    product: "Auto" as const,
    effectiveDate: "2026-01-01",
    expirationDate: "2026-07-01",
    status: "Active" as const,
    premium: 1200,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  __resetMigrationStateForTests();
});

describe("usePolicies — not-ready scope guard", () => {
  it("attempts no read while the scope is loading", () => {
    const { result } = renderHook(() => usePolicies(), {
      wrapper: wrapperFor({ status: "loading", backend: "supabase" }),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.policies).toEqual([]);
  });

  it("createPolicy returns a typed not_ready error and writes nothing while unauthenticated", async () => {
    const { result } = renderHook(() => usePolicies(), {
      wrapper: wrapperFor({ status: "unauthenticated", backend: "supabase" }),
    });

    let outcome: Awaited<ReturnType<typeof result.current.createPolicy>> | undefined;
    await act(async () => {
      outcome = await result.current.createPolicy(baseInput());
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe("not_ready");
  });
});

describe("usePolicies — demo mode", () => {
  const DEMO_SCOPE: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };

  it("list resolves successfully with an empty array by default", async () => {
    const { result } = renderHook(() => usePolicies(), { wrapper: wrapperFor(DEMO_SCOPE) });

    await waitFor(() => expect(result.current.policiesLoaded).toBe(true));
    expect(result.current.policies).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("create adds a policy visible in the list, and update changes its status", async () => {
    const { result } = renderHook(() => usePolicies(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.policiesLoaded).toBe(true));

    let created: Awaited<ReturnType<typeof result.current.createPolicy>> | undefined;
    await act(async () => {
      created = await result.current.createPolicy(baseInput());
    });
    expect(created?.ok).toBe(true);
    const createdId = created && created.ok ? created.data.id : "";

    await act(async () => {
      await result.current.updatePolicy(createdId, { status: "Cancelled" });
    });

    await waitFor(() =>
      expect(result.current.policies.find((p) => p.id === createdId)?.status).toBe("Cancelled")
    );
  });

  it("loadDemoPolicies then clearDemoPolicies round-trips a demo batch", async () => {
    const { result } = renderHook(() => usePolicies(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.policiesLoaded).toBe(true));

    await act(async () => {
      await result.current.loadDemoPolicies([
        { ...baseInput(), policyNumber: "SF-DEMO-1", isDemo: true },
        { ...baseInput(), policyNumber: "SF-DEMO-2", isDemo: true },
      ]);
    });
    await waitFor(() => expect(result.current.policies.filter((p) => p.isDemo)).toHaveLength(2));

    await act(async () => {
      await result.current.clearDemoPolicies();
    });
    await waitFor(() => expect(result.current.policies.filter((p) => p.isDemo)).toHaveLength(0));
  });
});
