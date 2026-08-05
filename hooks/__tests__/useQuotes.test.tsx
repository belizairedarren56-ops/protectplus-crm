import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { useQuotes } from "@/hooks/useQuotes";
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

describe("useQuotes — not-ready scope guard", () => {
  it("attempts no read while the scope is loading", () => {
    const { result } = renderHook(() => useQuotes(), {
      wrapper: wrapperFor({ status: "loading", backend: "supabase" }),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.quotes).toEqual([]);
  });

  it("createQuote returns a typed not_ready error and writes nothing while unauthenticated", async () => {
    const { result } = renderHook(() => useQuotes(), {
      wrapper: wrapperFor({ status: "unauthenticated", backend: "supabase" }),
    });

    let outcome: Awaited<ReturnType<typeof result.current.createQuote>> | undefined;
    await act(async () => {
      outcome = await result.current.createQuote({
        clientId: "client-1",
        clientName: "Jane Cooper",
        carrier: "State Farm",
        premium: 1000,
        insuranceType: "Auto",
        status: "Draft",
      });
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe("not_ready");
  });
});

describe("useQuotes — demo mode", () => {
  const DEMO_SCOPE: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };

  it("list resolves successfully with an empty array by default", async () => {
    const { result } = renderHook(() => useQuotes(), { wrapper: wrapperFor(DEMO_SCOPE) });

    await waitFor(() => expect(result.current.quotesLoaded).toBe(true));
    expect(result.current.quotes).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("create adds a quote visible in the list, and update changes its status", async () => {
    const { result } = renderHook(() => useQuotes(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.quotesLoaded).toBe(true));

    let created: Awaited<ReturnType<typeof result.current.createQuote>> | undefined;
    await act(async () => {
      created = await result.current.createQuote({
        clientId: "client-1",
        clientName: "Jane Cooper",
        carrier: "State Farm",
        premium: 1000,
        insuranceType: "Auto",
        status: "Draft",
      });
    });
    expect(created?.ok).toBe(true);
    const createdId = created && created.ok ? created.data.id : "";

    await act(async () => {
      await result.current.updateQuote(createdId, { status: "Accepted" });
    });

    await waitFor(() =>
      expect(result.current.quotes.find((q) => q.id === createdId)?.status).toBe("Accepted")
    );
  });

  it("loadDemoQuotes then clearDemoQuotes round-trips a demo batch", async () => {
    const { result } = renderHook(() => useQuotes(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.quotesLoaded).toBe(true));

    await act(async () => {
      await result.current.loadDemoQuotes([
        {
          clientId: "client-1",
          clientName: "Jane Cooper",
          carrier: "State Farm",
          premium: 900,
          insuranceType: "Auto",
          status: "Draft",
          isDemo: true,
        },
        {
          clientId: "client-2",
          clientName: "John Smith",
          carrier: "Allstate",
          premium: 1400,
          insuranceType: "Home",
          status: "Sent",
          isDemo: true,
        },
      ]);
    });
    await waitFor(() => expect(result.current.quotes.filter((q) => q.isDemo)).toHaveLength(2));

    await act(async () => {
      await result.current.clearDemoQuotes();
    });
    await waitFor(() => expect(result.current.quotes.filter((q) => q.isDemo)).toHaveLength(0));
  });
});
