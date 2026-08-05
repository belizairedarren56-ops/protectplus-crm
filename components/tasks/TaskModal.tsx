"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAccessScope } from "@/hooks/useAccessScope";
import { useAgencyProducers } from "@/hooks/useAgencyProducers";
import type { DataBackendError } from "@/lib/dataMode";
import { PRODUCERS } from "@/lib/constants";
import type { NewTaskInput } from "@/lib/repositories/tasksRepository";
import type { Result } from "@/lib/result";
import type { Priority, Task, TaskStatus } from "@/types";

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type FormState = {
  title: string;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  assignedToName: string; // demo mode only
  assignedToId: string; // supabase mode, admin only — "" means "assign to me" isn't resolved yet
};

function emptyForm(defaultAssignedToId: string): FormState {
  return {
    title: "",
    priority: "Medium",
    dueDate: todayIso(),
    status: "Open",
    assignedToName: PRODUCERS[0],
    assignedToId: defaultAssignedToId,
  };
}

type TaskModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewTaskInput) => Promise<Result<Task, DataBackendError>>;
  onUpdate: (id: string, patch: Partial<NewTaskInput>) => Promise<Result<Task, DataBackendError>>;
  task?: Task | null;
};

export function TaskModal({ open, onClose, onCreate, onUpdate, task }: TaskModalProps) {
  const scope = useAccessScope();
  const isSupabase = scope.backend === "supabase";
  const isAdmin = scope.status === "ready" && isSupabase && scope.role === "admin";
  const currentUserId = scope.status === "ready" && isSupabase ? scope.userId : "";
  // Only fires for an admin in supabase mode — see useAgencyProducers().
  const producersQuery = useAgencyProducers();

  const [formData, setFormData] = useState<FormState>(() =>
    task
      ? {
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate.slice(0, 10),
          status: task.status,
          assignedToName: task.assignedToName ?? PRODUCERS[0],
          assignedToId: task.assignedToId ?? currentUserId,
        }
      : emptyForm(currentUserId)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setFormData(emptyForm(currentUserId));
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    // assigned_to is NOT NULL with no server-side default for an admin
    // caller (force_owner_tasks() only forces it for non-admins) — an
    // admin must always send a real id; a producer omits it entirely and
    // lets the trigger fill in auth.uid(), same as AddClientModal's
    // producer path.
    const assignee = isSupabase
      ? isAdmin
        ? { assignedToId: formData.assignedToId || currentUserId }
        : {}
      : { assignedToName: formData.assignedToName };

    const input: NewTaskInput = {
      title: formData.title,
      priority: formData.priority,
      dueDate: formData.dueDate,
      status: formData.status,
      ...assignee,
    };

    const result = task ? await onUpdate(task.id, input) : await onCreate(input);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setFormData(emptyForm(currentUserId));
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={task ? "Edit Task" : "Create Task"}
      description="Assign follow-ups and to-dos to your team."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Task Title">
          <input
            required
            value={formData.title}
            onChange={(event) => setFormData({ ...formData, title: event.target.value })}
            className={FIELD_CLASSES}
            placeholder="Follow up on renewal quote"
          />
        </FormField>

        <div className="grid gap-5 md:grid-cols-3">
          <FormField label="Assigned To">
            {!isSupabase ? (
              <select
                value={formData.assignedToName}
                onChange={(event) => setFormData({ ...formData, assignedToName: event.target.value })}
                className={FIELD_CLASSES}
              >
                {PRODUCERS.map((producer) => (
                  <option key={producer}>{producer}</option>
                ))}
              </select>
            ) : isAdmin ? (
              <select
                value={formData.assignedToId}
                onChange={(event) => setFormData({ ...formData, assignedToId: event.target.value })}
                disabled={producersQuery.isLoading}
                className={`${FIELD_CLASSES} disabled:opacity-50`}
              >
                {(producersQuery.data ?? []).map((producer) => (
                  <option key={producer.id} value={producer.id}>
                    {producer.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <p className="w-full rounded-xl border border-gray-800 bg-black/50 px-4 py-3 text-gray-400">
                Assigned to you
              </p>
            )}
          </FormField>

          <FormField label="Priority">
            <select
              value={formData.priority}
              onChange={(event) =>
                setFormData({ ...formData, priority: event.target.value as Priority })
              }
              className={FIELD_CLASSES}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </FormField>

          <FormField label="Due Date">
            <input
              required
              type="date"
              value={formData.dueDate}
              onChange={(event) => setFormData({ ...formData, dueDate: event.target.value })}
              className={FIELD_CLASSES}
            />
          </FormField>
        </div>

        {error && <p role="alert" className="text-sm font-semibold text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : task ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold text-gray-300">{label}</span>
      {children}
    </label>
  );
}
