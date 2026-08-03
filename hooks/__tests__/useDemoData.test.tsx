import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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

    const storedClients = getItem<Client[]>(`${STORAGE_KEYS.clients}@v2`, []);
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

    const storedClients = getItem<Client[]>(`${STORAGE_KEYS.clients}@v2`, []);
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

    const storedClients = getItem<Client[]>(`${STORAGE_KEYS.clients}@v2`, []);
    expect(storedClients).toHaveLength(50);
  });

  it("Demo Data controls are always available in demo mode", () => {
    const { result } = renderHook(() => useDemoData(), { wrapper });
    expect(result.current.canManageDemoData).toBe(true);
  });
});
