import { Badge } from "@/components/ui/Badge";
import { Table, TableColumn } from "@/components/ui/Table";
import { POLICY_STATUS_STYLES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Policy } from "@/types";

export function PoliciesTab({ policies }: { policies: Policy[] }) {
  const columns: TableColumn<Policy>[] = [
    {
      key: "carrier",
      header: "Carrier",
      render: (policy) => <span className="font-bold text-white">{policy.carrier}</span>,
    },
    {
      key: "policyNumber",
      header: "Policy #",
      render: (policy) => <span className="text-gray-300">{policy.policyNumber}</span>,
    },
    {
      key: "product",
      header: "Product",
      render: (policy) => <span className="text-gray-300">{policy.product}</span>,
    },
    {
      key: "effective",
      header: "Effective",
      render: (policy) => <span className="text-gray-300">{formatDate(policy.effectiveDate)}</span>,
    },
    {
      key: "expiration",
      header: "Expiration",
      render: (policy) => <span className="text-gray-300">{formatDate(policy.expirationDate)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (policy) => <Badge className={POLICY_STATUS_STYLES[policy.status]}>{policy.status}</Badge>,
    },
    {
      key: "premium",
      header: "Premium",
      render: (policy) => <span className="font-bold text-white">{formatCurrency(policy.premium)}</span>,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={policies}
      rowKey={(policy) => policy.id}
      emptyMessage="No policies on file for this client."
    />
  );
}
