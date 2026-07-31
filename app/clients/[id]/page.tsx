"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ActivityTab } from "@/components/clients/tabs/ActivityTab";
import { DocumentsTab } from "@/components/clients/tabs/DocumentsTab";
import { FamilyTab } from "@/components/clients/tabs/FamilyTab";
import { NotesTab } from "@/components/clients/tabs/NotesTab";
import { OverviewTab } from "@/components/clients/tabs/OverviewTab";
import { PoliciesTab } from "@/components/clients/tabs/PoliciesTab";
import { QuotesTab } from "@/components/clients/tabs/QuotesTab";
import { TasksTab } from "@/components/clients/tabs/TasksTab";
import { useClients } from "@/hooks/useClients";
import { useDocuments } from "@/hooks/useDocuments";
import { usePolicies } from "@/hooks/usePolicies";
import { useQuotes } from "@/hooks/useQuotes";
import { useTasks } from "@/hooks/useTasks";

const TABS = [
  "Overview",
  "Policies",
  "Quotes",
  "Tasks",
  "Notes",
  "Documents",
  "Activity Timeline",
  "Family Members",
] as const;

type Tab = (typeof TABS)[number];

export default function ClientProfilePage() {
  const params = useParams();
  const clientId = Number(params.id);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const { clients, setClients, clientsLoaded } = useClients();
  const { policies } = usePolicies();
  const { quotes } = useQuotes();
  const { tasks } = useTasks();
  const { documents } = useDocuments();

  const client = clients.find((item) => item.id === clientId) ?? null;
  const clientPolicies = policies.filter((policy) => policy.clientId === clientId);
  const clientQuotes = quotes.filter((quote) => quote.clientId === clientId);
  const clientTasks = tasks.filter((task) => task.clientId === clientId);
  const clientDocuments = documents.filter((document) => document.clientId === clientId);

  if (!clientsLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Loading client...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black text-red-400">Client not found</h1>
          <Link
            href="/clients"
            className="mt-6 inline-block rounded-xl border border-yellow-500/40 px-5 py-3 font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Back to Clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar firstName={client.firstName} lastName={client.lastName} size="lg" />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
              ProtectPlus Client Profile
            </p>
            <h1 className="mt-1 text-4xl font-black sm:text-5xl">
              {client.firstName} {client.lastName}
            </h1>
          </div>
        </div>

        <Link
          href="/clients"
          className="rounded-xl border border-yellow-500/40 px-5 py-3 font-bold text-yellow-400 hover:bg-yellow-500/10"
        >
          Back to Clients
        </Link>
      </div>

      {client.archivedAt && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-600/40 bg-white/[0.03] px-5 py-3">
          <p className="text-sm font-bold text-gray-400">
            This client is archived and hidden from the default Clients list.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setClients((current) =>
                current.map((item) =>
                  item.id === client.id ? { ...item, archivedAt: undefined } : item
                )
              )
            }
          >
            Restore
          </Button>
        </div>
      )}

      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "whitespace-nowrap rounded-t-xl border-b-2 px-4 py-3 text-sm font-bold transition",
              activeTab === tab
                ? "border-yellow-400 text-yellow-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "Overview" && <OverviewTab client={client} />}
        {activeTab === "Policies" && <PoliciesTab policies={clientPolicies} />}
        {activeTab === "Quotes" && <QuotesTab quotes={clientQuotes} />}
        {activeTab === "Tasks" && <TasksTab tasks={clientTasks} />}
        {activeTab === "Notes" && <NotesTab clientId={client.id} />}
        {activeTab === "Documents" && <DocumentsTab documents={clientDocuments} />}
        {activeTab === "Activity Timeline" && (
          <ActivityTab
            client={client}
            policies={clientPolicies}
            quotes={clientQuotes}
            tasks={clientTasks}
          />
        )}
        {activeTab === "Family Members" && <FamilyTab client={client} />}
      </div>
    </div>
  );
}
