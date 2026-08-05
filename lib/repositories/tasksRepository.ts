import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import type { Priority, Task, TaskStatus } from "@/types";

export type NewTaskInput = {
  title: string;
  description?: string;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  clientId?: string;
  /** `demo` mode only — the Supabase repository ignores this and derives
   * the display name via the `clients` join at read time instead. */
  clientName?: string;
  /** Admin-only reassignment; omitted -> DB trigger defaults to auth.uid(). */
  assignedToId?: string;
  /** `demo` mode only — the Supabase repository ignores this and derives
   * the display name via the `profiles` join at read time instead. */
  assignedToName?: string;
  isDemo?: boolean;
};

// No archive — tasks has a real hard "Delete" action today (window.confirm
// then remove), matching the existing tasks_delete RLS policy (owner or
// admin).
export type TasksRepository = {
  list(): Promise<Result<Task[], DataBackendError>>;
  create(input: NewTaskInput): Promise<Result<Task, DataBackendError>>;
  update(id: string, patch: Partial<NewTaskInput>): Promise<Result<Task, DataBackendError>>;
  delete(id: string): Promise<Result<void, DataBackendError>>;
  createDemoBatch(inputs: NewTaskInput[]): Promise<Result<Task[], DataBackendError>>;
  clearAgencyDemoTasks(): Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"] & {
  assigned: { full_name: string } | null;
  client: { first_name: string; last_name: string } | null;
};

export function mapRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    assignedToId: row.assigned_to,
    assignedToName: row.assigned?.full_name ?? undefined,
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
    clientId: row.client_id ?? undefined,
    clientName: row.client ? `${row.client.first_name} ${row.client.last_name}` : undefined,
    isDemo: row.is_demo,
  };
}

function mapInputToRow(input: NewTaskInput, agencyId: string): Database["public"]["Tables"]["tasks"]["Insert"] {
  return {
    agency_id: agencyId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    due_date: input.dueDate,
    status: input.status,
    client_id: input.clientId,
    assigned_to: input.assignedToId,
    is_demo: input.isDemo ?? false,
  } as Database["public"]["Tables"]["tasks"]["Insert"];
}

// Only fields explicitly present in the patch — same corrected pattern
// established in clientsRepository.ts's mapPatchToRow.
function mapPatchToRow(patch: Partial<NewTaskInput>): Database["public"]["Tables"]["tasks"]["Update"] {
  const row: Database["public"]["Tables"]["tasks"]["Update"] = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.assignedToId !== undefined) row.assigned_to = patch.assignedToId;
  if (patch.isDemo !== undefined) row.is_demo = patch.isDemo;
  return row;
}

// tasks has three FKs to profiles (assigned_to, created_by, updated_by),
// so a bare profiles(full_name) embed is ambiguous — named against the
// exact composite FK constraint, same disambiguation clientsRepository.ts
// already needs for its own three-FKs-to-profiles case.
const SELECT_WITH_RELATIONS =
  "*, assigned:profiles!tasks_assigned_to_agency_id_fkey(full_name), client:clients!tasks_client_id_agency_id_fkey(first_name, last_name)";

function mapPostgrestError(error: PostgrestError): DataBackendError {
  if (error.code === "42501" || /permission denied|only an admin/i.test(error.message)) {
    return { kind: "denied", message: error.message, cause: error };
  }
  if (error.code === "23505") {
    return { kind: "validation", message: error.message, cause: error };
  }
  return { kind: "unknown", message: error.message, cause: error };
}

function mapUnknownError(error: unknown): DataBackendError {
  return {
    kind: "connection",
    message: error instanceof Error ? error.message : "Unable to reach Supabase.",
    cause: error,
  };
}

export function createTasksRepository(supabase: SupabaseClient<Database>, agencyId: string): TasksRepository {
  async function list(): Promise<Result<Task[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(SELECT_WITH_RELATIONS)
        .order("due_date", { ascending: true });

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as TaskRow[]).map(mapRowToTask) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function create(input: NewTaskInput): Promise<Result<Task, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert(mapInputToRow(input, agencyId))
        .select(SELECT_WITH_RELATIONS)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToTask(data as unknown as TaskRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function update(id: string, patch: Partial<NewTaskInput>): Promise<Result<Task, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update(mapPatchToRow(patch))
        .eq("id", id)
        .select(SELECT_WITH_RELATIONS)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToTask(data as unknown as TaskRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function del(id: string): Promise<Result<void, DataBackendError>> {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function createDemoBatch(inputs: NewTaskInput[]): Promise<Result<Task[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert(inputs.map((input) => mapInputToRow({ ...input, isDemo: true }, agencyId)))
        .select(SELECT_WITH_RELATIONS);

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as TaskRow[]).map(mapRowToTask) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function clearAgencyDemoTasks(): Promise<Result<{ deletedCount: number }, DataBackendError>> {
    try {
      const { data, error } = await supabase.rpc("clear_agency_demo_tasks");
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: { deletedCount: (data as number) ?? 0 } };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  return { list, create, update, delete: del, createDemoBatch, clearAgencyDemoTasks };
}
