"use client";

import { useAccessScope } from "@/hooks/useAccessScope";
import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import type { Document } from "@/types";

export function useDocuments() {
  const scope = useAccessScope();
  const { items, setItems, loaded } = useLocalStorageList<Document>("documents", scope);
  return { documents: items, setDocuments: setItems, documentsLoaded: loaded };
}
