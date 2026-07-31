"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { ClientFilters, ClientSortKey } from "@/components/clients/ClientFilters";
import { ClientTable } from "@/components/clients/ClientTable";
import { Button } from "@/components/ui/Button";
import { useClients } from "@/hooks/useClients";
import { clientsToCsv, downloadCsv, parseClientsCsv } from "@/lib/csv";
import type { InsuranceType } from "@/types";

const PAGE_SIZE = 10;

export default function ClientsPage() {
  const { clients, setClients, clientsLoaded } = useClients();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [insuranceType, setInsuranceType] = useState("");
  const [sortKey, setSortKey] = useState<ClientSortKey>("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showAddClient, setShowAddClient] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const archivedCount = useMemo(() => clients.filter((client) => client.archivedAt).length, [clients]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = clients.filter((client) => {
      const matchesArchived = showArchived ? Boolean(client.archivedAt) : !client.archivedAt;

      const matchesQuery =
        query.length === 0 ||
        `${client.firstName} ${client.lastName}`.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.phone.toLowerCase().includes(query) ||
        (client.policyNumber ?? "").toLowerCase().includes(query) ||
        (client.carrier ?? "").toLowerCase().includes(query) ||
        client.policyType.toLowerCase().includes(query);

      const matchesStatus = !status || client.status === status;
      const matchesInsuranceType =
        !insuranceType ||
        client.policyType === insuranceType ||
        (client.insuranceTypes ?? []).includes(insuranceType as InsuranceType);

      return matchesArchived && matchesQuery && matchesStatus && matchesInsuranceType;
    });

    result = [...result].sort((a, b) => {
      if (sortKey === "name") {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
      if (sortKey === "status") {
        return a.status.localeCompare(b.status);
      }
      return b.id - a.id;
    });

    return result;
  }, [clients, search, status, insuranceType, sortKey, showArchived]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function resetToFirstPage() {
    setPage(1);
  }

  // Archive only — no permanent-delete path exists in Phase 1. Archiving never
  // touches a client's policies, quotes, tasks, notes, or documents; it only
  // hides the client from the default view via `archivedAt`.
  function archiveClient(id: number) {
    setClients((current) =>
      current.map((client) =>
        client.id === id ? { ...client, archivedAt: new Date().toISOString() } : client
      )
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function restoreClient(id: number) {
    setClients((current) =>
      current.map((client) => (client.id === id ? { ...client, archivedAt: undefined } : client))
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function archiveSelected() {
    setClients((current) =>
      current.map((client) =>
        selectedIds.has(client.id) ? { ...client, archivedAt: new Date().toISOString() } : client
      )
    );
    setSelectedIds(new Set());
  }

  function restoreSelected() {
    setClients((current) =>
      current.map((client) =>
        selectedIds.has(client.id) ? { ...client, archivedAt: undefined } : client
      )
    );
    setSelectedIds(new Set());
  }

  function toggleSelect(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    const pageIds = paginatedClients.map((client) => client.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));

    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function exportCsv(onlySelected: boolean) {
    const rows = onlySelected
      ? clients.filter((client) => selectedIds.has(client.id))
      : filteredClients;

    if (rows.length === 0) return;

    downloadCsv(`protectplus-clients-${Date.now()}.csv`, clientsToCsv(rows));
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const imported = parseClientsCsv(text);

      setClients((current) => [
        ...imported.map((client, index) => ({ ...client, id: Date.now() + index })),
        ...current,
      ]);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
            ProtectPlus CRM
          </p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Clients</h1>
          <p className="mt-2 text-gray-400">Search and manage your insurance clients.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <Button variant="secondary" onClick={() => exportCsv(false)}>
            Export
          </Button>
          <Button onClick={() => setShowAddClient(true)}>+ New Client</Button>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-yellow-500/20 bg-black/70 p-6 backdrop-blur-sm">
        <ClientFilters
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            resetToFirstPage();
          }}
          status={status}
          onStatusChange={(value) => {
            setStatus(value);
            resetToFirstPage();
          }}
          insuranceType={insuranceType}
          onInsuranceTypeChange={(value) => {
            setInsuranceType(value);
            resetToFirstPage();
          }}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
        />
      </div>

      <div className="mt-4 flex gap-2 rounded-xl border border-yellow-500/20 bg-black/60 p-1 w-fit">
        <button
          onClick={() => {
            setShowArchived(false);
            resetToFirstPage();
            setSelectedIds(new Set());
          }}
          className={clsx(
            "rounded-lg px-4 py-2 text-sm font-bold transition",
            !showArchived ? "bg-yellow-500/20 text-yellow-300" : "text-gray-400 hover:text-gray-200"
          )}
        >
          Active
        </button>
        <button
          onClick={() => {
            setShowArchived(true);
            resetToFirstPage();
            setSelectedIds(new Set());
          }}
          className={clsx(
            "rounded-lg px-4 py-2 text-sm font-bold transition",
            showArchived ? "bg-yellow-500/20 text-yellow-300" : "text-gray-400 hover:text-gray-200"
          )}
        >
          Archived ({archivedCount})
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-5 py-3">
          <p className="text-sm font-bold text-yellow-300">
            {selectedIds.size} client{selectedIds.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportCsv(true)}>
              Export Selected
            </Button>
            {showArchived ? (
              <Button variant="secondary" size="sm" onClick={restoreSelected}>
                Restore Selected
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={archiveSelected}>
                Archive Selected
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        {!clientsLoaded ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 px-6 py-16 text-center text-gray-500">
            Loading clients...
          </div>
        ) : (
          <ClientTable
            clients={paginatedClients}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAllOnPage}
            onArchive={archiveClient}
            onRestore={restoreClient}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <AddClientModal
        open={showAddClient}
        onClose={() => setShowAddClient(false)}
        onAdd={(client) => setClients((current) => [client, ...current])}
      />
    </div>
  );
}
