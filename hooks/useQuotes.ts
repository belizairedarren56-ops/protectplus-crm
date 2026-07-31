"use client";

import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Quote } from "@/types";

export function useQuotes() {
  const { items, setItems, loaded } = useLocalStorageList<Quote>(STORAGE_KEYS.quotes);
  return { quotes: items, setQuotes: setItems, quotesLoaded: loaded };
}
