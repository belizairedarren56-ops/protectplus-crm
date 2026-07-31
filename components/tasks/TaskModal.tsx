"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PRODUCERS } from "@/lib/constants";
import type { Priority, Task } from "@/types";

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): Omit<Task, "id"> {
  return {
    title: "",
    assignedTo: PRODUCERS[0],
    priority: "Medium",
    dueDate: todayIso(),
    status: "Open",
  };
}

type TaskModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  task?: Task | null;
};

export function TaskModal({ open, onClose, onSave, task }: TaskModalProps) {
  const [formData, setFormData] = useState(() =>
    task
      ? {
          title: task.title,
          assignedTo: task.assignedTo,
          priority: task.priority,
          dueDate: task.dueDate.slice(0, 10),
          status: task.status,
          clientId: task.clientId,
          clientName: task.clientName,
        }
      : emptyForm()
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onSave({
      id: task?.id ?? Date.now(),
      ...formData,
    });

    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
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
            <select
              value={formData.assignedTo}
              onChange={(event) => setFormData({ ...formData, assignedTo: event.target.value })}
              className={FIELD_CLASSES}
            >
              {PRODUCERS.map((producer) => (
                <option key={producer}>{producer}</option>
              ))}
            </select>
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

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{task ? "Save Changes" : "Create Task"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-gray-300">{label}</label>
      {children}
    </div>
  );
}
