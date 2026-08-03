"use client";

import { useAccessScope } from "@/hooks/useAccessScope";
import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import type { Quote } from "@/types";

export function useQuotes() {
  const scope = useAccessScope();
  const { items, setItems, loaded } = useLocalStorageList<Quote>("quotes", scope);
  return { quotes: items, setQuotes: setItems, quotesLoaded: loaded };
}
