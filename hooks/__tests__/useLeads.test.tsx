import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AccessScopeContext, type AccessScope } from "@/hooks/useAccessScope";
import { useLeads } from "@/hooks/useLeads";
import type { DataBackendError } from "@/lib/dataMode";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import { demoLeadsRepository } from "@/lib/repositories/demoLeadsRepository";
import type { Result } from "@/lib/result";
import { createTestQueryClient } from "@/test-utils/renderWithProviders";
import type { Lead } from "@/types";

const DEMO_SCOPE: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };

function wrapperFor(scope: AccessScope, queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AccessScopeContext.Provider value={scope}>{children}</AccessScopeContext.Provider>
      </QueryClientProvider>
    );
  };
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    clientName: "Jane Cooper",
    insuranceType: "Auto",
    stage: "New",
    priority: "Medium",
    lastContact: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function okResult<T>(data: T): Result<T, DataBackendError> {
  return { ok: true, data };
}

function errResult<T>(message = "boom"): Result<T, DataBackendError> {
  return { ok: false, error: { kind: "unknown", message } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function neverResolves<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

beforeEach(() => {
  window.localStorage.clear();
  __resetMigrationStateForTests();
});

describe("useLeads — not-ready scope guard", () => {
  it("attempts no read while the scope is loading", () => {
    const { result } = renderHook(() => useLeads(), {
      wrapper: wrapperFor({ status: "loading", backend: "supabase" }, createTestQueryClient()),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.leads).toEqual([]);
  });

  it("createLead returns a typed not_ready error and writes nothing while unauthenticated", async () => {
    const { result } = renderHook(() => useLeads(), {
      wrapper: wrapperFor({ status: "unauthenticated", backend: "supabase" }, createTestQueryClient()),
    });

    let outcome: Awaited<ReturnType<typeof result.current.createLead>> | undefined;
    await act(async () => {
      outcome = await result.current.createLead({
        clientName: "Jane Cooper",
        insuranceType: "Auto",
        stage: "New",
        priority: "Medium",
      });
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe("not_ready");
  });
});

describe("useLeads — demo mode", () => {
  it("list resolves successfully with an empty array by default", async () => {
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, createTestQueryClient()) });

    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));
    expect(result.current.leads).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("create adds a lead visible in the list, and update changes its stage", async () => {
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, createTestQueryClient()) });
    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));

    let created: Awaited<ReturnType<typeof result.current.createLead>> | undefined;
    await act(async () => {
      created = await result.current.createLead({
        clientName: "Jane Cooper",
        insuranceType: "Auto",
        stage: "New",
        priority: "Medium",
      });
    });
    expect(created?.ok).toBe(true);
    const createdId = created && created.ok ? created.data.id : "";

    await act(async () => {
      await result.current.updateLead(createdId, { stage: "Contacted" });
    });

    await waitFor(() => expect(result.current.leads.find((l) => l.id === createdId)?.stage).toBe("Contacted"));
  });

  it("loadDemoLeads then clearDemoLeads round-trips a demo batch", async () => {
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, createTestQueryClient()) });
    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));

    await act(async () => {
      await result.current.loadDemoLeads([
        { clientName: "Jane Cooper", insuranceType: "Auto", stage: "New", priority: "Medium", isDemo: true },
        { clientName: "John Smith", insuranceType: "Home", stage: "Contacted", priority: "High", isDemo: true },
      ]);
    });
    await waitFor(() => expect(result.current.leads.filter((l) => l.isDemo)).toHaveLength(2));

    await act(async () => {
      await result.current.clearDemoLeads();
    });
    await waitFor(() => expect(result.current.leads.filter((l) => l.isDemo)).toHaveLength(0));
  });
});

describe("useLeads — optimistic updateLead", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates the cache synchronously inside onMutate, before the mocked repository call resolves", async () => {
    const lead = makeLead();
    vi.spyOn(demoLeadsRepository, "list").mockResolvedValueOnce(okResult([lead])).mockReturnValue(neverResolves());
    vi.spyOn(demoLeadsRepository, "update").mockReturnValue(neverResolves());

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, queryClient) });
    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));

    act(() => {
      void result.current.updateLead(lead.id, { stage: "Contacted" });
    });

    await waitFor(() => expect(result.current.leads.find((l) => l.id === lead.id)?.stage).toBe("Contacted"));
  });

  it("reverts only the affected lead once a rejected update settles, leaving every other lead untouched", async () => {
    const leadA = makeLead({ id: "lead-A", stage: "New" });
    const leadB = makeLead({ id: "lead-B", stage: "Contacted" });
    vi.spyOn(demoLeadsRepository, "list")
      .mockResolvedValueOnce(okResult([leadA, leadB]))
      .mockReturnValue(neverResolves());
    vi.spyOn(demoLeadsRepository, "update").mockResolvedValue(errResult("simulated failure"));

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, queryClient) });
    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));

    await act(async () => {
      await result.current.updateLead("lead-A", { stage: "Sold" });
    });

    expect(result.current.leads.find((l) => l.id === "lead-A")?.stage).toBe("New");
    expect(result.current.leads.find((l) => l.id === "lead-B")).toEqual(leadB);
  });

  it("two overlapping updates to the same lead: an older mutation's failure never reverts a newer mutation's success", async () => {
    const lead = makeLead({ id: "lead-1", stage: "New" });
    vi.spyOn(demoLeadsRepository, "list").mockResolvedValueOnce(okResult([lead])).mockReturnValue(neverResolves());

    const attemptA = deferred<Result<Lead, DataBackendError>>();
    const attemptB = deferred<Result<Lead, DataBackendError>>();
    vi.spyOn(demoLeadsRepository, "update")
      .mockReturnValueOnce(attemptA.promise)
      .mockReturnValueOnce(attemptB.promise);

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, queryClient) });
    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));

    let resultA!: Promise<Result<Lead, DataBackendError>>;
    let resultB!: Promise<Result<Lead, DataBackendError>>;

    act(() => {
      resultA = result.current.updateLead("lead-1", { stage: "Contacted" }); // mutation A starts
    });
    await waitFor(() => expect(result.current.leads[0].stage).toBe("Contacted"));

    act(() => {
      resultB = result.current.updateLead("lead-1", { stage: "Sold" }); // mutation B starts before A settles
    });
    await waitFor(() => expect(result.current.leads[0].stage).toBe("Sold"));

    // B succeeds first.
    attemptB.resolve(okResult({ ...lead, stage: "Sold" }));
    await act(async () => {
      await resultB;
    });
    expect(result.current.leads[0].stage).toBe("Sold");

    // A fails afterward — must NOT revert B's already-successful change.
    attemptA.resolve(errResult("stale failure"));
    await act(async () => {
      await resultA;
    });
    expect(result.current.leads[0].stage).toBe("Sold");
  });

  it("a failed update never reverts a different lead's successful, concurrent change", async () => {
    const leadX = makeLead({ id: "lead-X", stage: "New" });
    const leadY = makeLead({ id: "lead-Y", stage: "New" });
    vi.spyOn(demoLeadsRepository, "list")
      .mockResolvedValueOnce(okResult([leadX, leadY]))
      .mockReturnValue(neverResolves());

    const attemptX = deferred<Result<Lead, DataBackendError>>();
    const attemptY = deferred<Result<Lead, DataBackendError>>();
    vi.spyOn(demoLeadsRepository, "update").mockImplementation((id) =>
      id === "lead-X" ? attemptX.promise : attemptY.promise
    );

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, queryClient) });
    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));

    let resultX!: Promise<Result<Lead, DataBackendError>>;
    let resultY!: Promise<Result<Lead, DataBackendError>>;
    act(() => {
      resultX = result.current.updateLead("lead-X", { stage: "Contacted" });
      resultY = result.current.updateLead("lead-Y", { stage: "Sold" });
    });

    await waitFor(() => expect(result.current.leads.find((l) => l.id === "lead-Y")?.stage).toBe("Sold"));

    attemptY.resolve(okResult({ ...leadY, stage: "Sold" }));
    await act(async () => {
      await resultY;
    });
    expect(result.current.leads.find((l) => l.id === "lead-Y")?.stage).toBe("Sold");

    attemptX.resolve(errResult("boom"));
    await act(async () => {
      await resultX;
    });

    expect(result.current.leads.find((l) => l.id === "lead-X")?.stage).toBe("New"); // reverted
    expect(result.current.leads.find((l) => l.id === "lead-Y")?.stage).toBe("Sold"); // untouched
  });

  it("cancels any in-flight list query before applying the optimistic write", async () => {
    const lead = makeLead();
    vi.spyOn(demoLeadsRepository, "list").mockResolvedValueOnce(okResult([lead])).mockReturnValue(neverResolves());
    vi.spyOn(demoLeadsRepository, "update").mockReturnValue(neverResolves());

    const queryClient = createTestQueryClient();
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");
    const setDataSpy = vi.spyOn(queryClient, "setQueryData");

    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, queryClient) });
    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));

    cancelSpy.mockClear();
    setDataSpy.mockClear();

    act(() => {
      void result.current.updateLead(lead.id, { stage: "Contacted" });
    });

    await waitFor(() => expect(setDataSpy).toHaveBeenCalled());

    expect(cancelSpy).toHaveBeenCalled();
    const cancelOrder = cancelSpy.mock.invocationCallOrder[0];
    const setDataOrder = setDataSpy.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(setDataOrder);
  });

  it("does not invalidate the leads query when an older mutation settles while a newer one is still pending, and reconciles with exactly one refetch once both settle", async () => {
    const lead = makeLead();
    vi.spyOn(demoLeadsRepository, "list").mockResolvedValueOnce(okResult([lead])).mockReturnValue(neverResolves());

    const attemptA = deferred<Result<Lead, DataBackendError>>();
    const attemptB = deferred<Result<Lead, DataBackendError>>();
    vi.spyOn(demoLeadsRepository, "update")
      .mockReturnValueOnce(attemptA.promise)
      .mockReturnValueOnce(attemptB.promise);

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(DEMO_SCOPE, queryClient) });
    await waitFor(() => expect(result.current.leadsLoaded).toBe(true));

    let resultA!: Promise<Result<Lead, DataBackendError>>;
    let resultB!: Promise<Result<Lead, DataBackendError>>;
    act(() => {
      resultA = result.current.updateLead(lead.id, { stage: "Contacted" });
    });
    await waitFor(() => expect(result.current.leads[0].stage).toBe("Contacted"));
    act(() => {
      resultB = result.current.updateLead(lead.id, { stage: "Sold" });
    });
    await waitFor(() => expect(result.current.leads[0].stage).toBe("Sold"));

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    attemptA.resolve(okResult({ ...lead, stage: "Contacted" }));
    await act(async () => {
      await resultA;
    });

    // A settled while B is still pending — must NOT invalidate yet.
    expect(invalidateSpy).not.toHaveBeenCalled();

    attemptB.resolve(okResult({ ...lead, stage: "Sold" }));
    await act(async () => {
      await resultB;
    });

    // B was the last pending update — now it invalidates, exactly once.
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });
});
