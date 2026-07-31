"use client";

import { useState } from "react";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RecentClientsTable } from "@/components/dashboard/RecentClientsTable";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { PoliciesByTypeChart } from "@/components/dashboard/charts/PoliciesByTypeChart";
import { LeadConversionChart } from "@/components/dashboard/charts/LeadConversionChart";
import { MonthlyPremiumChart } from "@/components/dashboard/charts/MonthlyPremiumChart";
import { RenewalCalendar } from "@/components/dashboard/charts/RenewalCalendar";
import { Button } from "@/components/ui/Button";
import { useClients } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { usePolicies } from "@/hooks/usePolicies";
import { useTasks } from "@/hooks/useTasks";
import { formatCurrency } from "@/lib/format";

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isThisMonth(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export default function DashboardPage() {
  const [showAddClient, setShowAddClient] = useState(false);

  const { clients, setClients, clientsLoaded } = useClients();
  const { leads } = useLeads();
  const { quotes } = useQuotes();
  const { policies } = usePolicies();
  const { tasks } = useTasks();

  const todaysQuotes = quotes.filter((quote) => isToday(quote.createdAt)).length;
  const policiesWrittenThisMonth = policies.filter((policy) => isThisMonth(policy.effectiveDate)).length;
  const renewalsDue = policies.filter((policy) => policy.status === "Renewal Due").length;
  const newLeads = leads.filter((lead) => lead.stage === "New").length;
  const monthlyPremium = policies
    .filter((policy) => isThisMonth(policy.effectiveDate))
    .reduce((sum, policy) => sum + policy.premium, 0);
  const monthlyCommission = monthlyPremium * 0.12;
  const tasksDueToday = tasks.filter((task) => task.status === "Open" && isToday(task.dueDate)).length;

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
            Welcome back, Darren
          </p>
          <h2 className="mt-2 text-4xl font-black text-white sm:text-5xl">Dashboard</h2>
          <p className="mt-3 text-gray-400">Manage clients, policies, quotes, and leads.</p>
        </div>

        <Button onClick={() => setShowAddClient(true)}>+ New Client</Button>
      </header>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's Quotes" value={todaysQuotes.toString()} accent="blue" icon="📋" />
        <StatCard
          title="Policies Written This Month"
          value={policiesWrittenThisMonth.toString()}
          accent="gold"
          icon="🛡️"
        />
        <StatCard title="Renewals Due" value={renewalsDue.toString()} accent="red" icon="🔔" />
        <StatCard title="New Leads" value={newLeads.toString()} accent="emerald" icon="🎯" />
        <StatCard title="Monthly Premium" value={formatCurrency(monthlyPremium)} accent="gold" icon="💰" />
        <StatCard
          title="Monthly Commission"
          value={formatCurrency(monthlyCommission)}
          accent="silver"
          icon="💵"
          subtext="Placeholder — 12% estimated rate"
        />
        <StatCard title="Tasks Due Today" value={tasksDueToday.toString()} accent="blue" icon="✅" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PoliciesByTypeChart policies={policies} />
        <LeadConversionChart leads={leads} />
        <MonthlyPremiumChart policies={policies} />
        <RenewalCalendar policies={policies} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-yellow-400">Recent Clients</h3>
              <p className="mt-1 text-sm text-gray-500">
                Your newest ProtectPlus leads and customers.
              </p>
            </div>
          </div>

          {clientsLoaded ? (
            <RecentClientsTable clients={clients} />
          ) : (
            <div className="rounded-2xl border border-yellow-500/20 bg-black/75 px-6 py-12 text-center text-gray-500">
              Loading clients...
            </div>
          )}
        </div>

        <div className="space-y-6">
          <QuickActions onAddClient={() => setShowAddClient(true)} />
          <RecentActivity />
        </div>
      </div>

      <AddClientModal
        open={showAddClient}
        onClose={() => setShowAddClient(false)}
        onAdd={(client) => setClients((current) => [client, ...current])}
      />
    </div>
  );
}
