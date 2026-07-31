"use client";

import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Task } from "@/types";

export function useTasks() {
  const { items, setItems, loaded } = useLocalStorageList<Task>(STORAGE_KEYS.tasks);
  return { tasks: items, setTasks: setItems, tasksLoaded: loaded };
}
