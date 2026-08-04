"use client";

import { useAccessScope } from "@/hooks/useAccessScope";
import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import type { Task } from "@/types";

export function useTasks() {
  const scope = useAccessScope();
  const { items, setItems, loaded } = useLocalStorageList<Task>("tasks", scope);
  return { tasks: items, setTasks: setItems, tasksLoaded: loaded };
}
