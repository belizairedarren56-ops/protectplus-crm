"use client";

import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Lead } from "@/types";

export function useLeads() {
  const { items, setItems, loaded } = useLocalStorageList<Lead>(STORAGE_KEYS.leads);
  return { leads: items, setLeads: setItems, leadsLoaded: loaded };
}
