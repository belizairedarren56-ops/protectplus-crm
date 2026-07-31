import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDemoData } from "@/hooks/useDemoData";
import { STORAGE_KEYS, getItem } from "@/lib/storage";
import type { Client } from "@/types";

function seedRealClient(): Client {
  const client: Client = {
    id: 999_001,
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
  });

  it("loadDemoData populates every entity through the real hook setters", async () => {
    const { result } = renderHook(() => useDemoData());

    await waitFor(() => expect(result.current.hasDemoData).toBe(false));

    act(() => {
      result.current.loadDemoData();
    });

    await waitFor(() => expect(result.current.hasDemoData).toBe(true));
    expect(result.current.counts.clients).toBe(50);

    const storedClients = getItem<Client[]>(STORAGE_KEYS.clients, []);
    expect(storedClients).toHaveLength(50);
    expect(storedClients.every((client) => client.isDemo)).toBe(true);
  });

  it("clearDemoData removes only demo-tagged records, never a real one", async () => {
    const realClient = seedRealClient();

    const { result } = renderHook(() => useDemoData());
    await waitFor(() => expect(result.current.counts.clients).toBe(0));

    act(() => {
      result.current.loadDemoData();
    });
    await waitFor(() => expect(result.current.hasDemoData).toBe(true));

    act(() => {
      result.current.clearDemoData();
    });

    await waitFor(() => expect(result.current.hasDemoData).toBe(false));

    const storedClients = getItem<Client[]>(STORAGE_KEYS.clients, []);
    expect(storedClients).toHaveLength(1);
    expect(storedClients[0].id).toBe(realClient.id);
    expect(storedClients[0].isDemo).toBeFalsy();
  });

  it("reloading demo data replaces the previous demo set instead of accumulating duplicates", async () => {
    const { result } = renderHook(() => useDemoData());
    await waitFor(() => expect(result.current.hasDemoData).toBe(false));

    act(() => {
      result.current.loadDemoData();
    });
    await waitFor(() => expect(result.current.counts.clients).toBe(50));

    act(() => {
      result.current.loadDemoData();
    });
    await waitFor(() => expect(result.current.counts.clients).toBe(50));

    const storedClients = getItem<Client[]>(STORAGE_KEYS.clients, []);
    expect(storedClients).toHaveLength(50);
  });
});
