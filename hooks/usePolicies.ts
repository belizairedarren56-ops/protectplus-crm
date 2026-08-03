"use client";

import { useAccessScope } from "@/hooks/useAccessScope";
import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import type { Policy } from "@/types";

export function usePolicies() {
  const scope = useAccessScope();
  const { items, setItems, loaded } = useLocalStorageList<Policy>("policies", scope);
  return { policies: items, setPolicies: setItems, policiesLoaded: loaded };
}
