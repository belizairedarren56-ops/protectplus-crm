"use client";

import { useAccessScope } from "@/hooks/useAccessScope";
import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import type { Notification } from "@/types";

export function useNotifications() {
  const scope = useAccessScope();
  const { items, setItems, loaded } = useLocalStorageList<Notification>("notifications", scope);
  return {
    notifications: items,
    setNotifications: setItems,
    notificationsLoaded: loaded,
  };
}
