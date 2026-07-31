"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { INSURANCE_TYPE_ICONS, STATUS_BADGE_STYLES } from "@/lib/constants";
import type { Client } from "@/types";

type ClientTableProps = {
  clients: Client[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onDelete: (id: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function ClientTable({
  clients,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
  page,
  totalPages,
  onPageChange,
}: ClientTableProps) {
  const allSelected = clients.length > 0 && clients.every((client) => selectedIds.has(client.id));

  if (clients.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-yellow-500/20 bg-black/75 backdrop-blur-sm">
        <EmptyState
          icon="🔍"
          title="No matching clients found"
          description="Try adjusting your search or filters."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-yellow-500/20 bg-black/75 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="bg-white/5 text-xs font-bold uppercase tracking-wider text-gray-400">
              <th className="w-12 px-6 py-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 accent-yellow-500"
                />
              </th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Insurance</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Phone</th>
              <th className="px-6 py-4">Policy #</th>
              <th className="px-6 py-4">Carrier</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {clients.map((client) => (
              <tr
                key={client.id}
                className="border-t border-white/10 transition hover:bg-yellow-500/5"
              >
                <td className="px-6 py-5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(client.id)}
                    onChange={() => onToggleSelect(client.id)}
                    className="h-4 w-4 accent-yellow-500"
                  />
                </td>

                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={client.firstName} lastName={client.lastName} size="sm" />
                    <div>
                      <p className="font-bold text-white">
                        {client.firstName} {client.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{client.email}</p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-5">
                  <div className="flex items-center gap-1 text-lg">
                    {(client.insuranceTypes ?? [client.policyType]).map((type) => (
                      <span key={type} title={type}>
                        {INSURANCE_TYPE_ICONS[type as keyof typeof INSURANCE_TYPE_ICONS] ?? "📄"}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="px-6 py-5">
                  <Badge className={STATUS_BADGE_STYLES[client.status] ?? STATUS_BADGE_STYLES["New Lead"]}>
                    {client.status}
                  </Badge>
                </td>

                <td className="px-6 py-5 text-gray-300">{client.phone}</td>
                <td className="px-6 py-5 text-gray-300">{client.policyNumber ?? "—"}</td>
                <td className="px-6 py-5 text-gray-300">{client.carrier ?? "—"}</td>

                <td className="px-6 py-5">
                  <div className="flex gap-2">
                    <Link
                      href={`/clients/${client.id}`}
                      className="rounded-lg border border-yellow-500/40 px-4 py-2 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
                    >
                      View
                    </Link>
                    <Button variant="danger" size="sm" onClick={() => onDelete(client.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
