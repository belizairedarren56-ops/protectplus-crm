import { Badge } from "@/components/ui/Badge";
import { Table, TableColumn } from "@/components/ui/Table";
import { QUOTE_STATUS_STYLES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/types";

export function QuotesTab({ quotes }: { quotes: Quote[] }) {
  const columns: TableColumn<Quote>[] = [
    {
      key: "carrier",
      header: "Carrier",
      render: (quote) => <span className="font-bold text-white">{quote.carrier}</span>,
    },
    {
      key: "type",
      header: "Insurance Type",
      render: (quote) => <span className="text-gray-300">{quote.insuranceType}</span>,
    },
    {
      key: "coverage",
      header: "Coverage",
      render: (quote) => <span className="text-gray-300">{quote.coverage}</span>,
    },
    {
      key: "created",
      header: "Created",
      render: (quote) => <span className="text-gray-300">{formatDate(quote.createdAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (quote) => <Badge className={QUOTE_STATUS_STYLES[quote.status]}>{quote.status}</Badge>,
    },
    {
      key: "premium",
      header: "Premium",
      render: (quote) => <span className="font-bold text-white">{formatCurrency(quote.premium)}</span>,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={quotes}
      rowKey={(quote) => quote.id}
      emptyMessage="No quotes on file for this client."
    />
  );
}
