"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/Card";
import { Table, TableColumn } from "@/components/ui/Table";
import { useClients } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { usePolicies } from "@/hooks/usePolicies";
import { useQuotes } from "@/hooks/useQuotes";
import {
  CHART_AXIS_COLOR,
  CHART_COLORS,
  CHART_GRID_COLOR,
  CHART_SURFACE_COLOR,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

const TOOLTIP_STYLE = {
  background: CHART_SURFACE_COLOR,
  border: "1px solid rgba(234,179,8,0.3)",
  borderRadius: 12,
  color: "#fff",
};

export default function ReportsPage() {
  const { clients } = useClients();
  const { leads } = useLeads();
  const { quotes } = useQuotes();
  const { policies } = usePolicies();

  const activeLeads = leads.filter((lead) => lead.stage !== "Sold" && lead.stage !== "Lost").length;
  const soldLeads = leads.filter((lead) => lead.stage === "Sold").length;
  const conversionRate = leads.length > 0 ? (soldLeads / leads.length) * 100 : 0;
  const premiumWritten = policies.reduce((sum, policy) => sum + policy.premium, 0);
  const revenue = premiumWritten * 0.12;

  const producerTotals = new Map<string, number>();
  policies.forEach((policy) => {
    producerTotals.set(policy.producer, (producerTotals.get(policy.producer) ?? 0) + policy.premium);
  });
  const producerRankings = Array.from(producerTotals.entries())
    .map(([producer, premium]) => ({ producer, premium }))
    .sort((a, b) => b.premium - a.premium);

  const quoteStatusCounts = ["Draft", "Sent", "Accepted", "Declined", "Expired"].map((status) => ({
    status,
    count: quotes.filter((quote) => quote.status === status).length,
  }));

  const columns: TableColumn<(typeof producerRankings)[number]>[] = [
    {
      key: "producer",
      header: "Producer",
      render: (row) => <span className="font-bold text-white">{row.producer}</span>,
    },
    {
      key: "premium",
      header: "Premium Written",
      render: (row) => <span className="text-gray-300">{formatCurrency(row.premium)}</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
          ProtectPlus CRM
        </p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">Reports</h1>
        <p className="mt-2 text-gray-400">Agency performance at a glance.</p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Clients" value={clients.length.toString()} accent="gold" icon="👥" />
        <StatCard title="Total Policies" value={policies.length.toString()} accent="blue" icon="🛡️" />
        <StatCard title="Active Leads" value={activeLeads.toString()} accent="emerald" icon="🎯" />
        <StatCard
          title="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
          accent="red"
          icon="📈"
        />
        <StatCard title="Revenue" value={formatCurrency(revenue)} accent="gold" icon="💰" />
        <StatCard title="Premium Written" value={formatCurrency(premiumWritten)} accent="silver" icon="💵" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <p className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Producer Rankings — Premium Written
          </p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={producerRankings} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
                <XAxis
                  type="number"
                  tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`}
                  tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="producer"
                  width={130}
                  tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="premium" fill={CHART_COLORS.aqua} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Quotes by Status</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quoteStatusCounts} margin={{ left: -20 }}>
                <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
                <XAxis
                  dataKey="status"
                  tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={CHART_COLORS.magenta} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-4 text-2xl font-black text-yellow-400">Producer Rankings</h2>
        <Table
          columns={columns}
          rows={producerRankings}
          rowKey={(row) => row.producer}
          emptyMessage="No policy data yet."
        />
      </div>
    </div>
  );
}
