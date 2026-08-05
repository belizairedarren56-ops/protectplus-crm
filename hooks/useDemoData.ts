"use client";

import { useCallback } from "react";
import { useAccessScope } from "@/hooks/useAccessScope";
import { useClients } from "@/hooks/useClients";
import { useDocuments } from "@/hooks/useDocuments";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useLeads } from "@/hooks/useLeads";
import { useNotifications } from "@/hooks/useNotifications";
import { usePolicies } from "@/hooks/usePolicies";
import { useQuotes } from "@/hooks/useQuotes";
import { useTasks } from "@/hooks/useTasks";
import type { DataBackendError } from "@/lib/dataMode";
import { generateDemoClientDrafts, generateDemoDataForClients } from "@/lib/demoData";
import type { NewClientInput } from "@/lib/repositories/clientsRepository";
import type { Result } from "@/lib/result";

/**
 * The only place demo data is ever written. `demo` mode: unchanged in
 * substance — every entity's real mutation path, never a raw localStorage
 * write. `supabase` mode: the clients step goes through
 * loadDemoClients()/clearDemoClients() (admin-only — see Settings page —
 * both gated by RLS too, not just this UI), and because client UUIDs aren't
 * known until Postgres assigns them, the other entities' demo data is
 * generated *after* clients resolve, referencing their real returned ids —
 * not predicted up front the way a single-array localStorage pass could.
 *
 * Every failure-capable step (anything that's a real repository/RPC call,
 * not a synchronous local-state write) runs BEFORE the guaranteed-to-
 * succeed setLeads/setQuotes/setPolicies/setNotifications calls, in both
 * clearDemoData() and loadDemoData() — preserving the "abort before
 * touching the next entity" discipline even though not every entity this
 * hook touches can fail the same way anymore.
 */
export function useDemoData() {
  const scope = useAccessScope();
  const { clients, loadDemoClients, clearDemoClients } = useClients();
  const { leads, setLeads } = useLeads();
  const { quotes, setQuotes } = useQuotes();
  const { policies, setPolicies } = usePolicies();
  const { tasks, loadDemoTasks, clearDemoTasks } = useTasks();
  const { documents, loadDemoDocuments, clearDemoDocuments } = useDocuments();
  const { notifications, setNotifications } = useNotifications();
  const { familyMembers, createFamilyMember, deleteFamilyMember } = useFamilyMembers();

  const isAdmin = scope.status === "ready" && (scope.backend === "demo" || scope.role === "admin");
  const currentUserId = scope.status === "ready" && scope.backend === "supabase" ? scope.userId : null;

  const clearDemoData = useCallback(async (): Promise<Result<void, DataBackendError>> => {
    const cleared = await clearDemoClients();
    if (!cleared.ok) return cleared;

    const clearedDocuments = await clearDemoDocuments();
    if (!clearedDocuments.ok) return clearedDocuments;

    const clearedTasks = await clearDemoTasks();
    if (!clearedTasks.ok) return clearedTasks;

    // family_members has no is_demo tag and no dedicated clear RPC — in
    // `supabase` mode, Postgres's own `on delete cascade` already removed
    // these rows the instant their parent demo client was deleted above.
    // `demo` mode has no such cascade, and there is still no UI path to
    // create a family member outside this hook's loadDemoData() step below,
    // so every record that exists today is demo data by construction;
    // clearing them all here is exactly as safe as clearing any other
    // demo-tagged entity.
    if (scope.backend === "demo") {
      const deleted = await Promise.all(familyMembers.map((member) => deleteFamilyMember(member.id)));
      const deleteFailure = deleted.find((result) => !result.ok);
      if (deleteFailure && !deleteFailure.ok) return deleteFailure;
    }

    setLeads((current) => current.filter((lead) => !lead.isDemo));
    setQuotes((current) => current.filter((quote) => !quote.isDemo));
    setPolicies((current) => current.filter((policy) => !policy.isDemo));
    setNotifications((current) => current.filter((notification) => !notification.isDemo));

    return { ok: true, data: undefined };
  }, [
    clearDemoClients,
    clearDemoDocuments,
    clearDemoTasks,
    scope.backend,
    familyMembers,
    deleteFamilyMember,
    setLeads,
    setQuotes,
    setPolicies,
    setNotifications,
  ]);

  const loadDemoData = useCallback(async (): Promise<Result<void, DataBackendError>> => {
    // Clear any previously-loaded demo set first so repeated clicks replace
    // rather than accumulate; real records are untouched either way. Abort
    // the whole load if that initial clear fails — generating a second demo
    // set on top of a clear that only partially succeeded (or didn't run at
    // all) would compound the confusion rather than surface it.
    const clearResult = await clearDemoData();
    if (!clearResult.ok) return clearResult;

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
      isDemo: true,
    }));

    const created = await loadDemoClients(inputs);
    if (!created.ok) return created;

    const demo = generateDemoDataForClients(Date.now(), created.data);

    const loadedDocuments = await loadDemoDocuments(demo.documents);
    if (!loadedDocuments.ok) return loadedDocuments;

    // tasks.assigned_to is NOT NULL with no server-side default for an
    // admin caller (force_owner_tasks() only forces it for non-admins — see
    // tasksRepository.ts), and the generator has no real profile id to
    // assign from (assignedToName is a display-only string picked from the
    // PRODUCERS name list, not a resolvable id). In `supabase` mode, every
    // generated demo task is assigned to the admin performing this load;
    // `demo` mode has no such column constraint, so assignedToName alone is
    // enough there, unchanged.
    const tasksToLoad = currentUserId
      ? demo.tasks.map((task) => ({ ...task, assignedToId: currentUserId }))
      : demo.tasks;

    const loadedTasks = await loadDemoTasks(tasksToLoad);
    if (!loadedTasks.ok) return loadedTasks;

    // No batch-create endpoint for family_members (see
    // familyMembersRepository.ts) — created one at a time through the real
    // repository, same as clients go through loadDemoClients() rather than
    // a raw localStorage write.
    const familyMemberResults = await Promise.all(
      demo.familyMembers.map((input) => createFamilyMember(input))
    );
    const familyMemberFailure = familyMemberResults.find((result) => !result.ok);
    if (familyMemberFailure && !familyMemberFailure.ok) return familyMemberFailure;

    setLeads((current) => [...demo.leads, ...current]);
    setQuotes((current) => [...demo.quotes, ...current]);
    setPolicies((current) => [...demo.policies, ...current]);
    setNotifications((current) => [...demo.notifications, ...current]);

    return { ok: true, data: undefined };
  }, [
    clearDemoData,
    loadDemoClients,
    loadDemoDocuments,
    loadDemoTasks,
    createFamilyMember,
    currentUserId,
    setLeads,
    setQuotes,
    setPolicies,
    setNotifications,
  ]);

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
