"use client";

import { useState } from "react";
import { PolicyModal } from "@/components/policies/PolicyModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableColumn } from "@/components/ui/Table";
import { usePolicies } from "@/hooks/usePolicies";
import { POLICY_STATUS_STYLES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Policy, PolicyStatus } from "@/types";

const POLICY_STATUSES: PolicyStatus[] = ["Active", "Renewal Due", "Cancelled", "Expired"];

export default function PoliciesPage() {
  const { policies, setPolicies, policiesLoaded } = usePolicies();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingPolicy, setEditingPolicy] = useState<Policy | null | undefined>(undefined);

  const filtered = policies.filter((policy) => {
    const query = search.trim().toLowerCase();
    const matchesQuery =
      !query ||
      `${policy.clientName} ${policy.carrier} ${policy.policyNumber} ${policy.product}`
        .toLowerCase()
        .includes(query);
    const matchesStatus = !statusFilter || policy.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  function savePolicy(policy: Policy) {
    setPolicies((current) => {
      const exists = current.some((item) => item.id === policy.id);
      return exists
        ? current.map((item) => (item.id === policy.id ? policy : item))
        : [policy, ...current];
    });
  }

  function deletePolicy(id: number) {
    if (!window.confirm("Delete this policy?")) return;
    setPolicies((current) => current.filter((item) => item.id !== id));
  }

  const columns: TableColumn<Policy>[] = [
    {
      key: "client",
      header: "Client",
      render: (policy) => <span className="font-bold text-white">{policy.clientName}</span>,
    },
    {
      key: "carrier",
      header: "Carrier",
      render: (policy) => <span className="text-gray-300">{policy.carrier}</span>,
    },
    {
      key: "policyNumber",
      header: "Policy Number",
      render: (policy) => <span className="text-gray-300">{policy.policyNumber}</span>,
    },
    {
      key: "product",
      header: "Product",
      render: (policy) => <span className="text-gray-300">{policy.product}</span>,
    },
    {
      key: "effective",
      header: "Effective Date",
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
      render: (policy) => (
        <Badge className={POLICY_STATUS_STYLES[policy.status]}>{policy.status}</Badge>
      ),
    },
    {
      key: "premium",
      header: "Premium",
      render: (policy) => <span className="font-bold text-white">{formatCurrency(policy.premium)}</span>,
    },
    {
      key: "producer",
      header: "Producer",
      render: (policy) => <span className="text-gray-300">{policy.producer}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (policy) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditingPolicy(policy)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => deletePolicy(policy.id)}>
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
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Policies</h1>
          <p className="mt-2 text-gray-400">Every active, renewing, and expired policy on the book.</p>
        </div>

        <Button onClick={() => setEditingPolicy(null)}>+ Add Policy</Button>
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center">
        <SearchInput
          wrapperClassName="flex-1"
          placeholder="Search by client, carrier, policy #, or product..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500"
        >
          <option value="">All Statuses</option>
          {POLICY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {!policiesLoaded ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 px-6 py-16 text-center text-gray-500">
            Loading policies...
          </div>
        ) : (
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(policy) => policy.id}
            emptyMessage="No policies yet."
          />
        )}
      </div>

      <PolicyModal
        key={editingPolicy ? editingPolicy.id : "new"}
        open={editingPolicy !== undefined}
        onClose={() => setEditingPolicy(undefined)}
        onSave={savePolicy}
        policy={editingPolicy}
      />
    </div>
  );
}
