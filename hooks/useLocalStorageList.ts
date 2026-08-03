"use client";

import { useEffect, useState } from "react";
import { type AccessScope, scopeFingerprint } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { type LegacyEntityName, resolveStorageKey } from "@/lib/scopedStorage";
import { getItem, setItem } from "@/lib/storage";

export function useLocalStorageList<T>(entity: LegacyEntityName, scope: AccessScope) {
  const fingerprint = scopeFingerprint(entity, scope); // pure, recomputed every render

  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<DataBackendError | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Which fingerprint the state above actually belongs to — not necessarily
  // this render's fingerprint.
  const [dataFingerprint, setDataFingerprint] = useState<string | null>(null);

  // Adjust state during render, not in an effect: an effect only runs AFTER
  // React has already committed one render using the previous scope's
  // leftover state — a real, if brief, flash of stale data. React's
  // documented "adjust state during rendering" pattern re-runs this
  // component immediately with the reset state before anything is ever
  // painted, so the mismatched render is discarded, not shown.
  if (fingerprint !== dataFingerprint) {
    setItems([]);
    setLoaded(false);
    setError(null);
    setActiveKey(null);
    setDataFingerprint(fingerprint);
  }

  useEffect(() => {
    let cancelled = false;

    resolveStorageKey(entity, scope).then((result) => {
      if (cancelled) return; // unmounted, or scope already changed again
      if (!result.ok) {
        setError(result.error); // e.g. a migration failure — zero reads attempted
        return;
      }
      setItems(getItem<T[]>(result.data, []));
      setActiveKey(result.data); // only set once resolution AND the initial read succeed
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [entity, scope]);

  useEffect(() => {
    // Persist only with an exact fingerprint match — a second, independent
    // guard on the write path itself, not just the render-time reset above.
    if (!loaded || !activeKey || fingerprint !== dataFingerprint) return;
    setItem(activeKey, items);
  }, [activeKey, items, loaded, fingerprint, dataFingerprint]);

  // Defensive, explicit derived return — after the render-time reset above,
  // this branch is only reachable transiently, but it states the guarantee
  // directly: never return state that doesn't match this render's scope.
  if (fingerprint !== dataFingerprint) {
    return { items: [] as T[], setItems, loaded: false, error: null };
  }
  return { items, setItems, loaded, error };
}
