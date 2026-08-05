import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { AccessScopeContext, type AccessScope } from "@/hooks/useAccessScope";
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
});

describe("useFamilyMembers — not-ready scope guard", () => {
  it("attempts no read while the scope is loading", () => {
    const { result } = renderHook(() => useFamilyMembers(), {
      wrapper: wrapperFor({ status: "loading", backend: "supabase" }),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.familyMembers).toEqual([]);
  });

  it("createFamilyMember returns a typed not_ready error and writes nothing while unauthenticated", async () => {
    const { result } = renderHook(() => useFamilyMembers(), {
      wrapper: wrapperFor({ status: "unauthenticated", backend: "supabase" }),
    });

    let outcome: Awaited<ReturnType<typeof result.current.createFamilyMember>> | undefined;
    await act(async () => {
      outcome = await result.current.createFamilyMember({
        clientId: "some-client",
        name: "Jane Doe",
        relationship: "Spouse",
      });
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe("not_ready");
  });
});

describe("useFamilyMembers — demo mode", () => {
  const DEMO_SCOPE: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };

  it("list resolves successfully with an empty array by default", async () => {
    const { result } = renderHook(() => useFamilyMembers(), { wrapper: wrapperFor(DEMO_SCOPE) });

    await waitFor(() => expect(result.current.familyMembersLoaded).toBe(true));
    expect(result.current.familyMembers).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("create adds a member visible in the list, and delete removes it", async () => {
    const { result } = renderHook(() => useFamilyMembers(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.familyMembersLoaded).toBe(true));

    let created: Awaited<ReturnType<typeof result.current.createFamilyMember>> | undefined;
    await act(async () => {
      created = await result.current.createFamilyMember({
        clientId: "client-1",
        name: "Jane Doe",
        relationship: "Spouse",
      });
    });
    expect(created?.ok).toBe(true);

    await waitFor(() => expect(result.current.familyMembers.some((m) => m.name === "Jane Doe")).toBe(true));

    const createdId = created && created.ok ? created.data.id : "";
    await act(async () => {
      await result.current.deleteFamilyMember(createdId);
    });

    await waitFor(() => expect(result.current.familyMembers.some((m) => m.id === createdId)).toBe(false));
  });
});
