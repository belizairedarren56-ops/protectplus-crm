import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { STATUS_BADGE_STYLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Client } from "@/types";

export function OverviewTab({ client }: { client: Client }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Contact</p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="mt-1 font-bold text-white">{client.phone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="mt-1 font-bold text-white">{client.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Address</p>
            <p className="mt-1 font-bold text-white">
              {client.address
                ? `${client.address}, ${client.city}, ${client.state} ${client.zip}`
                : "—"}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Insurance</p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-sm text-gray-500">Insurance Type</p>
            <p className="mt-1 font-bold text-white">{client.policyType}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <Badge
              className={`mt-2 inline-block ${
                STATUS_BADGE_STYLES[client.status] ?? STATUS_BADGE_STYLES["New Lead"]
              }`}
            >
              {client.status}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-gray-500">Carrier</p>
            <p className="mt-1 font-bold text-white">{client.carrier ?? "—"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Client ID</p>
        <p className="mt-5 break-all font-mono text-yellow-400">{client.id}</p>

        <p className="mt-5 text-sm text-gray-500">Client Since</p>
        <p className="mt-1 font-bold text-white">
          {client.createdAt ? formatDate(client.createdAt) : "—"}
        </p>
      </Card>
    </div>
  );
}
