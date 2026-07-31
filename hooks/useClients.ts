"use client";

import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Client } from "@/types";

export function useClients() {
  const { items, setItems, loaded } = useLocalStorageList<Client>(STORAGE_KEYS.clients);
  return { clients: items, setClients: setItems, clientsLoaded: loaded };
}
