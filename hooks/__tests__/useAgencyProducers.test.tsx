import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAgencyProducers } from "@/hooks/useAgencyProducers";
import { AccessScopeContext, type AccessScope } from "@/hooks/useAccessScope";
import type { Database } from "@/lib/supabase/database.types";
import { createTestQueryClient } from "@/test-utils/renderWithProviders";
import type { ReactNode } from "react";

// A client that throws the instant any query method is called — proves
// zero I/O for scopes where useAgencyProducers() must never fire, rather
// than inferring it indirectly from query-state flags alone.
const poisonedClient = {
  from: () => {
    throw new Error("useAgencyProducers must not query for this scope");
  },
} as unknown as SupabaseClient<Database>;

function mockClientReturning(data: { id: string; full_name: string }[]): SupabaseClient<Database> {
  return {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data, error: null }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

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

describe("useAgencyProducers — enabled only for a ready, supabase-mode admin", () => {
  it("never fires while the scope is loading", async () => {
    const { result } = renderHook(() => useAgencyProducers(), {
      wrapper: wrapperFor({ status: "loading", backend: "supabase" }),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("never fires while unauthenticated", async () => {
    const { result } = renderHook(() => useAgencyProducers(), {
      wrapper: wrapperFor({ status: "unauthenticated", backend: "supabase" }),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("never fires while the scope has errored", async () => {
    const { result } = renderHook(() => useAgencyProducers(), {
      wrapper: wrapperFor({
        status: "error",
        backend: "supabase",
        error: { kind: "unknown", message: "boom" },
      }),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("never fires in demo mode (no real roles)", async () => {
    const { result } = renderHook(() => useAgencyProducers(), {
      wrapper: wrapperFor({ status: "ready", backend: "demo", agencyId: null, userId: null, role: null }),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("never fires for a ready, non-admin (producer) supabase scope — proven via a poisoned client", async () => {
    const { result } = renderHook(() => useAgencyProducers(), {
      wrapper: wrapperFor({
        status: "ready",
        backend: "supabase",
        agencyId: "agency-1",
        userId: "user-1",
        role: "producer",
        supabaseClient: poisonedClient,
      }),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    // If the query had fired, the poisoned client's .from() would have
    // thrown synchronously inside the queryFn and surfaced as isError.
    expect(result.current.isError).toBe(false);
  });

  it("does fire for a ready, admin supabase scope (positive control)", async () => {
    const { result } = renderHook(() => useAgencyProducers(), {
      wrapper: wrapperFor({
        status: "ready",
        backend: "supabase",
        agencyId: "agency-1",
        userId: "admin-1",
        role: "admin",
        supabaseClient: mockClientReturning([{ id: "p1", full_name: "Maria Gonzalez" }]),
      }),
    });

    await waitFor(() => expect(result.current.data).toEqual([{ id: "p1", fullName: "Maria Gonzalez" }]));
  });
});
