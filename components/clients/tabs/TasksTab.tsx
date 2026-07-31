import { Badge } from "@/components/ui/Badge";
import { Table, TableColumn } from "@/components/ui/Table";
import { PRIORITY_BADGE_STYLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Task } from "@/types";

export function TasksTab({ tasks }: { tasks: Task[] }) {
  const columns: TableColumn<Task>[] = [
    {
      key: "title",
      header: "Task",
      render: (task) => <span className="font-bold text-white">{task.title}</span>,
    },
    {
      key: "assignedTo",
      header: "Assigned To",
      render: (task) => <span className="text-gray-300">{task.assignedTo}</span>,
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
      key: "status",
      header: "Status",
      render: (task) => (
        <Badge
          className={
            task.status === "Complete"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-blue-500/40 bg-blue-500/10 text-blue-400"
          }
        >
          {task.status}
        </Badge>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={tasks}
      rowKey={(task) => task.id}
      emptyMessage="No tasks linked to this client."
    />
  );
}
