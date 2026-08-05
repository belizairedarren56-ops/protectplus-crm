"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableColumn } from "@/components/ui/Table";
import { PRIORITY_BADGE_STYLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Task } from "@/types";

type TaskListProps = {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
};

export function TaskList({ tasks, onToggleComplete, onEdit, onDelete }: TaskListProps) {
  const columns: TableColumn<Task>[] = [
    {
      key: "done",
      header: "",
      className: "w-12",
      render: (task) => (
        <input
          type="checkbox"
          checked={task.status === "Complete"}
          onChange={() => onToggleComplete(task.id)}
          className="h-4 w-4 accent-yellow-500"
        />
      ),
    },
    {
      key: "title",
      header: "Task",
      render: (task) => (
        <div>
          <p
            className={`font-bold ${task.status === "Complete" ? "text-gray-500 line-through" : "text-white"}`}
          >
            {task.title}
          </p>
          {task.clientName && <p className="text-xs text-gray-500">{task.clientName}</p>}
        </div>
      ),
    },
    {
      key: "assignedTo",
      header: "Assigned To",
      render: (task) => <span className="text-gray-300">{task.assignedToName ?? "—"}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (task) => <Badge className={PRIORITY_BADGE_STYLES[task.priority]}>{task.priority}</Badge>,
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (task) => <span className="text-gray-300">{formatDate(task.dueDate)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (task) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(task)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(task.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Table columns={columns} rows={tasks} rowKey={(task) => task.id} emptyMessage="No tasks yet." />
  );
}
