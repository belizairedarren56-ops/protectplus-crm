import type { DataBackendError } from "@/lib/dataMode";
import { activeLegacyKey, ensureLocalDataMigrated } from "@/lib/localDataMigrations";
import type { NewTaskInput, TasksRepository } from "@/lib/repositories/tasksRepository";
import type { Result } from "@/lib/result";
import { getItem, setItem } from "@/lib/storage";
import type { Task } from "@/types";

// Same activeLegacyKey()-resolved read-transform-write shape as
// demoDocumentsRepository.ts — tasks was already one of the seven
// MIGRATED_KEYS entities; its id-format migration now also stringifies its
// own id and renames the legacy assignedTo field to assignedToName (see
// lib/localDataMigrations.ts), so an existing browser's data carries over.

function toTask(input: NewTaskInput, id: string): Task {
  return {
    id,
    title: input.title,
    description: input.description,
    assignedToName: input.assignedToName,
    priority: input.priority,
    dueDate: input.dueDate,
    status: input.status,
    clientId: input.clientId,
    clientName: input.clientName,
    isDemo: input.isDemo ?? false,
  };
}

async function withMigratedKey<T>(
  fn: (key: string) => Result<T, DataBackendError>
): Promise<Result<T, DataBackendError>> {
  const migrated = await ensureLocalDataMigrated();
  if (!migrated.ok) return migrated;

  const keyResult = activeLegacyKey("tasks");
  if (!keyResult.ok) return keyResult;

  return fn(keyResult.data);
}

export const demoTasksRepository: TasksRepository = {
  async list() {
    return withMigratedKey((key) => ({ ok: true, data: getItem<Task[]>(key, []) }));
  },

  async create(input) {
    return withMigratedKey((key) => {
      const tasks = getItem<Task[]>(key, []);
      const task = toTask(input, String(Date.now()));
      setItem(key, [task, ...tasks]);
      return { ok: true, data: task };
    });
  },

  async update(id, patch) {
    return withMigratedKey((key) => {
      const tasks = getItem<Task[]>(key, []);
      let updated: Task | null = null;
      const next = tasks.map((task) => {
        if (task.id !== id) return task;
        updated = { ...task, ...patch };
        return updated;
      });
      if (!updated) {
        return { ok: false, error: { kind: "validation", message: `No demo task with id ${id}` } };
      }
      setItem(key, next);
      return { ok: true, data: updated };
    });
  },

  async delete(id) {
    return withMigratedKey((key) => {
      const tasks = getItem<Task[]>(key, []);
      setItem(
        key,
        tasks.filter((task) => task.id !== id)
      );
      return { ok: true, data: undefined };
    });
  },

  async createDemoBatch(inputs) {
    return withMigratedKey((key) => {
      const tasks = getItem<Task[]>(key, []);
      const created = inputs.map((input, index) => toTask({ ...input, isDemo: true }, `${Date.now()}-${index}`));
      setItem(key, [...created, ...tasks]);
      return { ok: true, data: created };
    });
  },

  async clearAgencyDemoTasks() {
    return withMigratedKey((key) => {
      const tasks = getItem<Task[]>(key, []);
      const remaining = tasks.filter((task) => !task.isDemo);
      const deletedCount = tasks.length - remaining.length;
      setItem(key, remaining);
      return { ok: true, data: { deletedCount } };
    });
  },
};
