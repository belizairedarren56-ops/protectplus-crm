"use client";

import { useEffect, useState } from "react";
import { getItem, setItem } from "@/lib/storage";

export function useLocalStorageList<T>(key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage isn't available during SSR, so this has to run post-mount;
    // the `loaded` flag lets callers render a stable fallback until it does.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(getItem<T[]>(key, []));
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    setItem(key, items);
  }, [key, items, loaded]);

  return { items, setItems, loaded };
}
