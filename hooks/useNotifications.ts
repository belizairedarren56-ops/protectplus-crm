"use client";

import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Notification } from "@/types";

export function useNotifications() {
  const { items, setItems, loaded } = useLocalStorageList<Notification>(
    STORAGE_KEYS.notifications
  );
  return {
    notifications: items,
    setNotifications: setItems,
    notificationsLoaded: loaded,
  };
}
