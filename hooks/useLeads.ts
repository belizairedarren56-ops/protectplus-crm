"use client";

import { useAccessScope } from "@/hooks/useAccessScope";
import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import type { Lead } from "@/types";

export function useLeads() {
  const scope = useAccessScope();
  const { items, setItems, loaded } = useLocalStorageList<Lead>("leads", scope);
  return { leads: items, setLeads: setItems, leadsLoaded: loaded };
}
