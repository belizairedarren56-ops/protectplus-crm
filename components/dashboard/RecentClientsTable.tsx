"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Table, TableColumn } from "@/components/ui/Table";
import { STATUS_BADGE_STYLES } from "@/lib/constants";
import type { Client } from "@/types";

export function RecentClientsTable({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const recent = clients
    .filter((client) => !client.archivedAt)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 6);

  const columns: TableColumn<Client>[] = [
    {
      key: "name",
      header: "Name",
      render: (client) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={client.firstName} lastName={client.lastName} size="sm" />
          <div>
            <p className="font-bold text-white">
              {client.firstName} {client.lastName}
            </p>
            <p className="text-xs text-gray-500">{client.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Insurance Type",
      render: (client) => <span className="text-gray-300">{client.policyType}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (client) => (
        <Badge className={STATUS_BADGE_STYLES[client.status] ?? STATUS_BADGE_STYLES["New Lead"]}>
          {client.status}
        </Badge>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (client) => <span className="text-gray-300">{client.phone}</span>,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={recent}
      rowKey={(client) => client.id}
      emptyMessage="No clients added yet."
      onRowClick={(client) => router.push(`/clients/${client.id}`)}
    />
  );
}
