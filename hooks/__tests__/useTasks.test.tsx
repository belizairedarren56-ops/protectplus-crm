import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { useTasks } from "@/hooks/useTasks";
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

describe("useTasks — not-ready scope guard", () => {
  it("attempts no read while the scope is loading", () => {
    const { result } = renderHook(() => useTasks(), {
      wrapper: wrapperFor({ status: "loading", backend: "supabase" }),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.tasks).toEqual([]);
  });

  it("createTask returns a typed not_ready error and writes nothing while unauthenticated", async () => {
    const { result } = renderHook(() => useTasks(), {
      wrapper: wrapperFor({ status: "unauthenticated", backend: "supabase" }),
    });

    let outcome: Awaited<ReturnType<typeof result.current.createTask>> | undefined;
    await act(async () => {
      outcome = await result.current.createTask({
        title: "Call client",
        priority: "Medium",
        dueDate: "2026-01-01",
        status: "Open",
      });
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe("not_ready");
  });
});

describe("useTasks — demo mode", () => {
  const DEMO_SCOPE: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };

  it("list resolves successfully with an empty array by default", async () => {
    const { result } = renderHook(() => useTasks(), { wrapper: wrapperFor(DEMO_SCOPE) });

    await waitFor(() => expect(result.current.tasksLoaded).toBe(true));
    expect(result.current.tasks).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("create adds a task visible in the list, and update changes its status", async () => {
    const { result } = renderHook(() => useTasks(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.tasksLoaded).toBe(true));

    let created: Awaited<ReturnType<typeof result.current.createTask>> | undefined;
    await act(async () => {
      created = await result.current.createTask({
        title: "Call client",
        priority: "Medium",
        dueDate: "2026-01-01",
        status: "Open",
      });
    });
    expect(created?.ok).toBe(true);
    const createdId = created && created.ok ? created.data.id : "";

    await act(async () => {
      await result.current.updateTask(createdId, { status: "Complete" });
    });

    await waitFor(() =>
      expect(result.current.tasks.find((t) => t.id === createdId)?.status).toBe("Complete")
    );
  });

  it("loadDemoTasks then clearDemoTasks round-trips a demo batch", async () => {
    const { result } = renderHook(() => useTasks(), { wrapper: wrapperFor(DEMO_SCOPE) });
    await waitFor(() => expect(result.current.tasksLoaded).toBe(true));

    await act(async () => {
      await result.current.loadDemoTasks([
        { title: "Demo 1", priority: "Low", dueDate: "2026-01-01", status: "Open", isDemo: true },
        { title: "Demo 2", priority: "High", dueDate: "2026-01-02", status: "Open", isDemo: true },
      ]);
    });
    await waitFor(() => expect(result.current.tasks.filter((t) => t.isDemo)).toHaveLength(2));

    await act(async () => {
      await result.current.clearDemoTasks();
    });
    await waitFor(() => expect(result.current.tasks.filter((t) => t.isDemo)).toHaveLength(0));
  });
});
