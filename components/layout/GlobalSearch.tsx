"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { useClients } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { usePolicies } from "@/hooks/usePolicies";
import { useTasks } from "@/hooks/useTasks";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const { clients } = useClients();
  const { leads } = useLeads();
  const { quotes } = useQuotes();
  const { policies } = usePolicies();
  const { tasks } = useTasks();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;

    return {
      clients: clients
        .filter((client) =>
          `${client.firstName} ${client.lastName} ${client.email} ${client.phone}`
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 5),
      leads: leads.filter((lead) => lead.clientName.toLowerCase().includes(q)).slice(0, 5),
      quotes: quotes.filter((quote) => quote.clientName.toLowerCase().includes(q)).slice(0, 5),
      policies: policies
        .filter(
          (policy) =>
            policy.clientName.toLowerCase().includes(q) ||
            policy.policyNumber.toLowerCase().includes(q)
        )
        .slice(0, 5),
      tasks: tasks.filter((task) => task.title.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [query, clients, leads, quotes, policies, tasks]);

  const hasResults =
    results !== null &&
    results.clients.length +
      results.leads.length +
      results.quotes.length +
      results.policies.length +
      results.tasks.length >
      0;

  const showPanel = focused && query.trim().length >= 2;

  return (
    <div className="relative max-w-xl">
      <SearchInput
        placeholder="Search clients, policies, quotes, tasks, leads..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />

      {showPanel && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-yellow-500/30 bg-[#0b0d12] shadow-2xl shadow-black/50">
          {!hasResults || results === null ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No matches found.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto py-2">
              {results.clients.length > 0 && (
                <ResultGroup title="Clients">
                  {results.clients.map((client) => (
                    <SearchResult
                      key={client.id}
                      href={`/clients/${client.id}`}
                      label={`${client.firstName} ${client.lastName}`}
                      meta={client.email}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.leads.length > 0 && (
                <ResultGroup title="Leads">
                  {results.leads.map((lead) => (
                    <SearchResult key={lead.id} href="/leads" label={lead.clientName} meta={lead.stage} />
                  ))}
                </ResultGroup>
              )}

              {results.quotes.length > 0 && (
                <ResultGroup title="Quotes">
                  {results.quotes.map((quote) => (
                    <SearchResult
                      key={quote.id}
                      href="/quotes"
                      label={quote.clientName}
                      meta={quote.status}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.policies.length > 0 && (
                <ResultGroup title="Policies">
                  {results.policies.map((policy) => (
                    <SearchResult
                      key={policy.id}
                      href="/policies"
                      label={policy.clientName}
                      meta={policy.policyNumber}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.tasks.length > 0 && (
                <ResultGroup title="Tasks">
                  {results.tasks.map((task) => (
                    <SearchResult key={task.id} href="/tasks" label={task.title} meta={task.status} />
                  ))}
                </ResultGroup>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-1">
      <p className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-500">{title}</p>
      {children}
    </div>
  );
}

function SearchResult({ href, label, meta }: { href: string; label: string; meta: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-yellow-500/10"
    >
      <span className="text-gray-200">{label}</span>
      <span className="text-xs text-gray-500">{meta}</span>
    </Link>
  );
}
