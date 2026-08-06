import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDemoData } from "@/hooks/useDemoData";
import { createTestQueryClient, DEMO_SCOPE } from "@/test-utils/renderWithProviders";
import { QueryClientProvider } from "@tanstack/react-query";
import { AccessScopeContext } from "@/hooks/useAccessScope";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import { STORAGE_KEYS, getItem } from "@/lib/storage";
import type { Client } from "@/types";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <AccessScopeContext.Provider value={DEMO_SCOPE}>{children}</AccessScopeContext.Provider>
    </QueryClientProvider>
  );
}

function seedRealClient(): Client {
  const client: Client = {
    id: "999001",
    firstName: "Real",
    lastName: "Customer",
    phone: "954-555-0000",
    email: "real.customer@example.com",
    policyType: "Auto",
    status: "Active",
  };
  window.localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify([client]));
  return client;
}

describe("useDemoData", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetMigrationStateForTests();
  });

  it("loadDemoData populates every entity through the real hook setters", async () => {
    const { result } = renderHook(() => useDemoData(), { wrapper });

    await waitFor(() => expect(result.current.hasDemoData).toBe(false));

    await act(async () => {
      await result.current.loadDemoData();
    });

    await waitFor(() => expect(result.current.hasDemoData).toBe(true));
    expect(result.current.counts.clients).toBe(50);

    const storedClients = getItem<Client[]>(`${STORAGE_KEYS.clients}@v3`, []);
    expect(storedClients).toHaveLength(50);
    expect(storedClients.every((client) => client.isDemo)).toBe(true);
  });

  it("clearDemoData removes only demo-tagged records, never a real one", async () => {
    const realClient = seedRealClient();

    const { result } = renderHook(() => useDemoData(), { wrapper });
    await waitFor(() => expect(result.current.counts.clients).toBe(0));

    await act(async () => {
      await result.current.loadDemoData();
    });
    await waitFor(() => expect(result.current.hasDemoData).toBe(true));

    await act(async () => {
      await result.current.clearDemoData();
    });

    await waitFor(() => expect(result.current.hasDemoData).toBe(false));

    const storedClients = getItem<Client[]>(`${STORAGE_KEYS.clients}@v3`, []);
    expect(storedClients).toHaveLength(1);
    expect(storedClients[0].id).toBe(realClient.id);
    expect(storedClients[0].isDemo).toBeFalsy();
  });

  it("reloading demo data replaces the previous demo set instead of accumulating duplicates", async () => {
    const { result } = renderHook(() => useDemoData(), { wrapper });
    await waitFor(() => expect(result.current.hasDemoData).toBe(false));

    await act(async () => {
      await result.current.loadDemoData();
    });
    await waitFor(() => expect(result.current.counts.clients).toBe(50));

    await act(async () => {
      await result.current.loadDemoData();
    });
    await waitFor(() => expect(result.current.counts.clients).toBe(50));

    const storedClients = getItem<Client[]>(`${STORAGE_KEYS.clients}@v3`, []);
    expect(storedClients).toHaveLength(50);
  });

  it("Demo Data controls are always available in demo mode", () => {
    const { result } = renderHook(() => useDemoData(), { wrapper });
    expect(result.current.canManageDemoData).toBe(true);
  });

  it("clearDemoData returns a typed error and leaves other local entities untouched when the clients clear fails", async () => {
    const { result } = renderHook(() => useDemoData(), { wrapper });
    await waitFor(() => expect(result.current.hasDemoData).toBe(false));

    await act(async () => {
      await result.current.loadDemoData();
    });
    await waitFor(() => expect(result.current.hasDemoData).toBe(true));
    const leadsCountBefore = result.current.counts.leads;
    expect(leadsCountBefore).toBeGreaterThan(0);

    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === `${STORAGE_KEYS.clients}@v3`) throw new Error("simulated storage failure");
      return originalSetItem.call(this, key, value);
    });

    let clearResult: Awaited<ReturnType<typeof result.current.clearDemoData>> | undefined;
    await act(async () => {
      clearResult = await result.current.clearDemoData();
    });
    setItemSpy.mockRestore();

    expect(clearResult?.ok).toBe(false);
    // The failed clients clear aborted before touching any of the other six
    // still-local entities — leads (and, by the same code path, quotes,
    // policies, tasks, documents, notifications) are untouched.
    expect(result.current.counts.leads).toBe(leadsCountBefore);
  });

  it("loadDemoData aborts without generating a new demo set when the initial clear fails", async () => {
    const { result } = renderHook(() => useDemoData(), { wrapper });
    await waitFor(() => expect(result.current.hasDemoData).toBe(false));

    await act(async () => {
      await result.current.loadDemoData();
    });
    await waitFor(() => expect(result.current.hasDemoData).toBe(true));
    const clientsCountAfterFirstLoad = result.current.counts.clients;

    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === `${STORAGE_KEYS.clients}@v3`) throw new Error("simulated storage failure");
      return originalSetItem.call(this, key, value);
    });

    let loadResult: Awaited<ReturnType<typeof result.current.loadDemoData>> | undefined;
    await act(async () => {
      loadResult = await result.current.loadDemoData();
    });
    setItemSpy.mockRestore();

    expect(loadResult?.ok).toBe(false);
    // clearDemoData() (loadDemoData()'s first step) failed, so no new demo
    // batch was ever generated or loaded.
    expect(result.current.counts.clients).toBe(clientsCountAfterFirstLoad);
  });
});
