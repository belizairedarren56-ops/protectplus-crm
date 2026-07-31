"use client";

import { useCallback } from "react";
import { generateDemoData } from "@/lib/demoData";
import { useClients } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { usePolicies } from "@/hooks/usePolicies";
import { useTasks } from "@/hooks/useTasks";
import { useDocuments } from "@/hooks/useDocuments";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * The only place demo data is ever written. Both `loadDemoData` and
 * `clearDemoData` go through each entity's real `setX` setter — never a raw
 * localStorage write — so demo data flows through the same React-state path
 * as every other mutation and there's nothing left to race against a hook's
 * own load/save effects.
 *
 * Every demo record is tagged `isDemo: true` (see lib/demoData.ts), so
 * `clearDemoData` can remove exactly those and never touch a real,
 * user-entered record.
 */
export function useDemoData() {
  const { clients, setClients } = useClients();
  const { leads, setLeads } = useLeads();
  const { quotes, setQuotes } = useQuotes();
  const { policies, setPolicies } = usePolicies();
  const { tasks, setTasks } = useTasks();
  const { documents, setDocuments } = useDocuments();
  const { notifications, setNotifications } = useNotifications();

  const clearDemoData = useCallback(() => {
    setClients((current) => current.filter((client) => !client.isDemo));
    setLeads((current) => current.filter((lead) => !lead.isDemo));
    setQuotes((current) => current.filter((quote) => !quote.isDemo));
    setPolicies((current) => current.filter((policy) => !policy.isDemo));
    setTasks((current) => current.filter((task) => !task.isDemo));
    setDocuments((current) => current.filter((document) => !document.isDemo));
    setNotifications((current) => current.filter((notification) => !notification.isDemo));
  }, [setClients, setLeads, setQuotes, setPolicies, setTasks, setDocuments, setNotifications]);

  const loadDemoData = useCallback(() => {
    // Clear any previously-loaded demo set first so repeated clicks replace
    // rather than accumulate; real records are untouched either way.
    clearDemoData();

    const demo = generateDemoData(Date.now());

    setClients((current) => [...demo.clients, ...current]);
    setLeads((current) => [...demo.leads, ...current]);
    setQuotes((current) => [...demo.quotes, ...current]);
    setPolicies((current) => [...demo.policies, ...current]);
    setTasks((current) => [...demo.tasks, ...current]);
    setDocuments((current) => [...demo.documents, ...current]);
    setNotifications((current) => [...demo.notifications, ...current]);
  }, [clearDemoData, setClients, setLeads, setQuotes, setPolicies, setTasks, setDocuments, setNotifications]);

  const demoClientCount = clients.filter((client) => client.isDemo).length;
  const hasDemoData =
    demoClientCount > 0 ||
    leads.some((lead) => lead.isDemo) ||
    quotes.some((quote) => quote.isDemo) ||
    policies.some((policy) => policy.isDemo) ||
    tasks.some((task) => task.isDemo) ||
    documents.some((document) => document.isDemo) ||
    notifications.some((notification) => notification.isDemo);

  return {
    loadDemoData,
    clearDemoData,
    hasDemoData,
    counts: {
      clients: demoClientCount,
      leads: leads.filter((lead) => lead.isDemo).length,
      quotes: quotes.filter((quote) => quote.isDemo).length,
      policies: policies.filter((policy) => policy.isDemo).length,
      tasks: tasks.filter((task) => task.isDemo).length,
      documents: documents.filter((document) => document.isDemo).length,
    },
  };
}
