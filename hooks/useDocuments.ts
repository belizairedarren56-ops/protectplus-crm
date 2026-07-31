"use client";

import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Document } from "@/types";

export function useDocuments() {
  const { items, setItems, loaded } = useLocalStorageList<Document>(STORAGE_KEYS.documents);
  return { documents: items, setDocuments: setItems, documentsLoaded: loaded };
}
