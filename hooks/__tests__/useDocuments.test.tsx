import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { useDocuments } from "@/hooks/useDocuments";
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

describe("useDocuments — not-ready scope guard", () => {
  it("attempts no read while the scope is loading", () => {
    const { result } = renderHook(() => useDocuments(), {
      wrapper: wrapperFor({ status: "loading", backend: "supabase" }),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.documents).toEqual([]);
  });

  it("createDocument returns a typed not_ready error and writes nothing while unauthenticated", async () => {
    const { result } = renderHook(() => useDocuments(), {
      wrapper: wrapperFor({ status: "unauthenticated", backend: "supabase" }),
    });

    let outcome: Awaited<ReturnType<typeof result.current.createDocument>> | undefined;
    await act(async () => {
      outcome = await result.current.createDocument({
        name: "app.pdf",
        folder: "Applications",
        fileType: "pdf",
      });
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe("not_ready");
  });
});

describe("useDocuments — demo mode", () => {
  const DEMO_SCOPE: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };

  it("list resolves successfully with an empty array by default", async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper: wrapperFor(DEMO_SCOPE) });

    await waitFor(() => expect(result.current.documentsLoaded).toBe(true));
    expect(result.current.documents).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("create adds a document visible in the list", async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.documentsLoaded).toBe(true));

    let created: Awaited<ReturnType<typeof result.current.createDocument>> | undefined;
    await act(async () => {
      created = await result.current.createDocument({
        name: "app.pdf",
        folder: "Applications",
        fileType: "pdf",
      });
    });
    expect(created?.ok).toBe(true);

    await waitFor(() => expect(result.current.documents.some((d) => d.name === "app.pdf")).toBe(true));
  });

  it("loadDemoDocuments then clearDemoDocuments round-trips a demo batch", async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.documentsLoaded).toBe(true));

    await act(async () => {
      await result.current.loadDemoDocuments([
        { name: "demo1.pdf", folder: "Applications", fileType: "pdf", isDemo: true },
        { name: "demo2.pdf", folder: "Declarations", fileType: "pdf", isDemo: true },
      ]);
    });
    await waitFor(() => expect(result.current.documents.filter((d) => d.isDemo)).toHaveLength(2));

    await act(async () => {
      await result.current.clearDemoDocuments();
    });
    await waitFor(() => expect(result.current.documents.filter((d) => d.isDemo)).toHaveLength(0));
  });
});
