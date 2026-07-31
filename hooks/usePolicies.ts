"use client";

import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Policy } from "@/types";

export function usePolicies() {
  const { items, setItems, loaded } = useLocalStorageList<Policy>(STORAGE_KEYS.policies);
  return { policies: items, setPolicies: setItems, policiesLoaded: loaded };
}
