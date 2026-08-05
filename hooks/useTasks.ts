"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { demoTasksRepository } from "@/lib/repositories/demoTasksRepository";
import { createTasksRepository, type NewTaskInput, type TasksRepository } from "@/lib/repositories/tasksRepository";
import { unavailableTasksRepository } from "@/lib/repositories/unavailableTasksRepository";
import { unwrap, type Result } from "@/lib/result";
import type { Task } from "@/types";

export function tasksQueryKey(scope: AccessScope) {
  return [
    "tasks",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ] as const;
}

function getTasksRepository(scope: AccessScope): TasksRepository {
  if (scope.status !== "ready") return unavailableTasksRepository;
  if (scope.backend === "demo") return demoTasksRepository;
  return createTasksRepository(scope.supabaseClient, scope.agencyId);
}

export type TasksApi = {
  tasks: Task[];
  tasksLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
  error: DataBackendError | null;
  createTask: (input: NewTaskInput) => Promise<Result<Task, DataBackendError>>;
  updateTask: (id: string, patch: Partial<NewTaskInput>) => Promise<Result<Task, DataBackendError>>;
  deleteTask: (id: string) => Promise<Result<void, DataBackendError>>;
  loadDemoTasks: (inputs: NewTaskInput[]) => Promise<Result<Task[], DataBackendError>>;
  clearDemoTasks: () => Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

// Full-list-fetch, client-side filter by clientId — same continuity
// decision as every other still-per-scope entity. TasksTab needs no
// changes: it still receives a pre-filtered array prop.
export function useTasks(): TasksApi {
  const scope = useAccessScope();
  const repository = getTasksRepository(scope);
  const queryClient = useQueryClient();
  const queryKey = tasksQueryKey(scope);

  const query = useQuery<Task[], DataBackendError>({
    queryKey,
    queryFn: () => unwrap(repository.list()),
    enabled: scope.status === "ready",
  });

  const createMutation = useMutation<Task, DataBackendError, NewTaskInput>({
    mutationFn: (input) => unwrap(repository.create(input)),
    onSuccess: (task) => {
      queryClient.setQueryData<Task[]>(queryKey, (current) => [task, ...(current ?? [])]);
    },
  });

  const updateMutation = useMutation<Task, DataBackendError, { id: string; patch: Partial<NewTaskInput> }>({
    mutationFn: ({ id, patch }) => unwrap(repository.update(id, patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<Task[]>(queryKey, (current) =>
        (current ?? []).map((task) => (task.id === updated.id ? updated : task))
      );
    },
  });

  const deleteMutation = useMutation<void, DataBackendError, string>({
    mutationFn: (id) => unwrap(repository.delete(id)),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Task[]>(queryKey, (current) => (current ?? []).filter((task) => task.id !== id));
    },
  });

  const loadDemoMutation = useMutation<Task[], DataBackendError, NewTaskInput[]>({
    mutationFn: (inputs) => unwrap(repository.createDemoBatch(inputs)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const clearDemoMutation = useMutation<{ deletedCount: number }, DataBackendError, void>({
    mutationFn: () => unwrap(repository.clearAgencyDemoTasks()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isLoading = query.isLoading || scope.status === "loading";

  return {
    tasks: query.data ?? [],
    tasksLoaded: !isLoading,
    isLoading,
    isError: query.isError || scope.status === "error",
    error: query.error ?? (scope.status === "error" ? scope.error : null),
    createTask: async (input) => {
      try {
        return { ok: true, data: await createMutation.mutateAsync(input) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    updateTask: async (id, patch) => {
      try {
        return { ok: true, data: await updateMutation.mutateAsync({ id, patch }) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    deleteTask: async (id) => {
      try {
        await deleteMutation.mutateAsync(id);
        return { ok: true, data: undefined };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    loadDemoTasks: async (inputs) => {
      try {
        return { ok: true, data: await loadDemoMutation.mutateAsync(inputs) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    clearDemoTasks: async () => {
      try {
        return { ok: true, data: await clearDemoMutation.mutateAsync() };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
  };
}
