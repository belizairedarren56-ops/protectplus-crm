"use client";

import { useState } from "react";
import { QuoteModal } from "@/components/quotes/QuoteModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableColumn } from "@/components/ui/Table";
import { useQuotes } from "@/hooks/useQuotes";
import { QUOTE_STATUS_STYLES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/types";

export default function QuotesPage() {
  const { quotes, setQuotes, quotesLoaded } = useQuotes();
  const [search, setSearch] = useState("");
  const [editingQuote, setEditingQuote] = useState<Quote | null | undefined>(undefined);

  const filtered = quotes.filter((quote) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${quote.clientName} ${quote.carrier} ${quote.insuranceType}`.toLowerCase().includes(query);
  });

  function saveQuote(quote: Quote) {
    setQuotes((current) => {
      const exists = current.some((item) => item.id === quote.id);
      return exists
        ? current.map((item) => (item.id === quote.id ? quote : item))
        : [quote, ...current];
    });
  }

  function deleteQuote(id: number) {
    if (!window.confirm("Delete this quote?")) return;
    setQuotes((current) => current.filter((item) => item.id !== id));
  }

  const columns: TableColumn<Quote>[] = [
    {
      key: "client",
      header: "Customer",
      render: (quote) => <span className="font-bold text-white">{quote.clientName}</span>,
    },
    {
      key: "carrier",
      header: "Carrier",
      render: (quote) => <span className="text-gray-300">{quote.carrier}</span>,
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
      key: "producer",
      header: "Producer",
      render: (quote) => <span className="text-gray-300">{quote.producer}</span>,
    },
    {
      key: "premium",
      header: "Premium",
      render: (quote) => <span className="font-bold text-white">{formatCurrency(quote.premium)}</span>,
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
      key: "actions",
      header: "Actions",
      render: (quote) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditingQuote(quote)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => deleteQuote(quote.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
            ProtectPlus CRM
          </p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Quotes</h1>
          <p className="mt-2 text-gray-400">Track carrier quotes from draft through acceptance.</p>
        </div>

        <Button onClick={() => setEditingQuote(null)}>+ New Quote</Button>
      </div>

      <div className="mt-8">
        <SearchInput
          placeholder="Search by client, carrier, or insurance type..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mt-6">
        {!quotesLoaded ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 px-6 py-16 text-center text-gray-500">
            Loading quotes...
          </div>
        ) : (
          <Table columns={columns} rows={filtered} rowKey={(quote) => quote.id} emptyMessage="No quotes yet." />
        )}
      </div>

      <QuoteModal
        key={editingQuote ? editingQuote.id : "new"}
        open={editingQuote !== undefined}
        onClose={() => setEditingQuote(undefined)}
        onSave={saveQuote}
        quote={editingQuote}
      />
    </div>
  );
}
