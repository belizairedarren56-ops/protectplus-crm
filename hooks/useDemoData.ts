"use client";

import { useCallback } from "react";
import { useAccessScope } from "@/hooks/useAccessScope";
import { useClients } from "@/hooks/useClients";
import { useDocuments } from "@/hooks/useDocuments";
import { useLeads } from "@/hooks/useLeads";
import { useNotifications } from "@/hooks/useNotifications";
import { usePolicies } from "@/hooks/usePolicies";
import { useQuotes } from "@/hooks/useQuotes";
import { useTasks } from "@/hooks/useTasks";
import { generateDemoClientDrafts, generateDemoDataForClients } from "@/lib/demoData";
import type { NewClientInput } from "@/lib/repositories/clientsRepository";

/**
 * The only place demo data is ever written. `demo` mode: unchanged in
 * substance — every entity's real mutation path, never a raw localStorage
 * write. `supabase` mode: the clients step goes through
 * loadDemoClients()/clearDemoClients() (admin-only — see Settings page —
 * both gated by RLS too, not just this UI), and because client UUIDs aren't
 * known until Postgres assigns them, the other six entities' demo data is
 * generated *after* clients resolve, referencing their real returned ids —
 * not predicted up front the way a single-array localStorage pass could.
 */
export function useDemoData() {
  const scope = useAccessScope();
  const { clients, loadDemoClients, clearDemoClients } = useClients();
  const { leads, setLeads } = useLeads();
  const { quotes, setQuotes } = useQuotes();
  const { policies, setPolicies } = usePolicies();
  const { tasks, setTasks } = useTasks();
  const { documents, setDocuments } = useDocuments();
  const { notifications, setNotifications } = useNotifications();

  const isAdmin = scope.status === "ready" && (scope.backend === "demo" || scope.role === "admin");

  const clearDemoData = useCallback(async () => {
    await clearDemoClients();
    setLeads((current) => current.filter((lead) => !lead.isDemo));
    setQuotes((current) => current.filter((quote) => !quote.isDemo));
    setPolicies((current) => current.filter((policy) => !policy.isDemo));
    setTasks((current) => current.filter((task) => !task.isDemo));
    setDocuments((current) => current.filter((document) => !document.isDemo));
    setNotifications((current) => current.filter((notification) => !notification.isDemo));
  }, [clearDemoClients, setLeads, setQuotes, setPolicies, setTasks, setDocuments, setNotifications]);

  const loadDemoData = useCallback(async () => {
    // Clear any previously-loaded demo set first so repeated clicks replace
    // rather than accumulate; real records are untouched either way.
    await clearDemoData();

    const drafts = generateDemoClientDrafts(50);
    const inputs: NewClientInput[] = drafts.map((draft) => ({
      firstName: draft.firstName,
      lastName: draft.lastName,
      phone: draft.phone,
      email: draft.email,
      policyType: draft.policyType,
      status: draft.status,
      address: draft.address,
      city: draft.city,
      state: draft.state,
      zip: draft.zip,
      carrier: draft.carrier,
      policyNumber: draft.policyNumber,
      insuranceTypes: draft.insuranceTypes,
      assignedProducerName: draft.assignedProducerName,
      familyMembers: draft.familyMembers,
      isDemo: true,
    }));

    const created = await loadDemoClients(inputs);
    if (!created.ok) return;

    const demo = generateDemoDataForClients(Date.now(), created.data);

    setLeads((current) => [...demo.leads, ...current]);
    setQuotes((current) => [...demo.quotes, ...current]);
    setPolicies((current) => [...demo.policies, ...current]);
    setTasks((current) => [...demo.tasks, ...current]);
    setDocuments((current) => [...demo.documents, ...current]);
    setNotifications((current) => [...demo.notifications, ...current]);
  }, [clearDemoData, loadDemoClients, setLeads, setQuotes, setPolicies, setTasks, setDocuments, setNotifications]);

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
    // Demo Data controls are admin-only in `supabase` mode (a producer who
    // could create demo clients but never clear them would leave orphaned
    // data only an admin could clean up) — enforced here for the UI and, at
    // the database level, by clients_insert's is_demo check and
    // clear_agency_demo_clients()'s admin-only RPC. Always true in `demo`
    // mode, which has no real roles.
    canManageDemoData: isAdmin,
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
