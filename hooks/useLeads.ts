"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { demoLeadsRepository } from "@/lib/repositories/demoLeadsRepository";
import { createLeadsRepository, type LeadsRepository, type NewLeadInput } from "@/lib/repositories/leadsRepository";
import { unavailableLeadsRepository } from "@/lib/repositories/unavailableLeadsRepository";
import { unwrap, type Result } from "@/lib/result";
import type { Lead } from "@/types";

export function leadsQueryKey(scope: AccessScope) {
  return [
    "leads",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ] as const;
}

function getLeadsRepository(scope: AccessScope): LeadsRepository {
  if (scope.status !== "ready") return unavailableLeadsRepository;
  if (scope.backend === "demo") return demoLeadsRepository;
  return createLeadsRepository(scope.supabaseClient, scope.agencyId);
}

export type LeadsApi = {
  leads: Lead[];
  leadsLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
  error: DataBackendError | null;
  createLead: (input: NewLeadInput) => Promise<Result<Lead, DataBackendError>>;
  updateLead: (id: string, patch: Partial<NewLeadInput>) => Promise<Result<Lead, DataBackendError>>;
  deleteLead: (id: string) => Promise<Result<void, DataBackendError>>;
  loadDemoLeads: (inputs: NewLeadInput[]) => Promise<Result<Lead[], DataBackendError>>;
  clearDemoLeads: () => Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

type UpdateLeadMutationContext = { id: string; seq: number; previousLead: Lead | undefined };

// Full-list-fetch, client-side filter by stage — same continuity decision
// as every other entity's hook.
export function useLeads(): LeadsApi {
  const scope = useAccessScope();
  const repository = getLeadsRepository(scope);
  const queryClient = useQueryClient();
  const queryKey = leadsQueryKey(scope);

  // updateLead is the one genuinely new pattern this phase: the Kanban
  // drag needs to feel instant, so its mutation is optimistic — unlike
  // every other entity's plain onSuccess-based mutations, which need no
  // latency-hiding. Scoped per-lead (not a whole-array snapshot) and
  // guarded by a per-lead sequence number so an older, overlapping
  // mutation's failure can never clobber a newer mutation's optimistic or
  // already-settled state — see onError below.
  const leadMutationSeq = useRef(new Map<string, number>());
  // Count of update mutations currently in flight, across every lead —
  // gates the reconciling refetch so an earlier mutation settling while a
  // later one is still pending never triggers a refetch that could
  // overwrite the later mutation's still-pending optimistic write.
  const pendingLeadUpdates = useRef(0);
  // Per-lead serialized network queue — the sequence-number guard above
  // only protects the LOCAL optimistic cache from a stale rollback; it
  // does nothing to stop two concurrent requests for the SAME lead from
  // completing at Supabase out of order (e.g. an older "Contacted" request
  // finishing after a newer "Sold" request, leaving the database on the
  // stale value even though the cache and every rollback guard behaved
  // correctly). Chaining each lead's actual repository.update() calls onto
  // a per-lead promise tail guarantees they reach the database in the same
  // order the user issued them — the newer request never even starts
  // until the older one has fully settled — so the last-issued update
  // always wins, regardless of relative network latency. Different leads
  // get independent queue entries and still update fully concurrently.
  const leadUpdateQueues = useRef(new Map<string, Promise<unknown>>());

  function enqueueForLead<T>(id: string, task: () => Promise<T>): Promise<T> {
    const previous = leadUpdateQueues.current.get(id) ?? Promise.resolve();
    // Chain onto the previous task regardless of whether it succeeded or
    // failed — an older update's failure must never permanently block a
    // newer update for the same lead.
    const next = previous.then(task, task);
    leadUpdateQueues.current.set(id, next);
    return next;
  }

  const query = useQuery<Lead[], DataBackendError>({
    queryKey,
    queryFn: () => unwrap(repository.list()),
    enabled: scope.status === "ready",
  });

  const createMutation = useMutation<Lead, DataBackendError, NewLeadInput>({
    mutationFn: (input) => unwrap(repository.create(input)),
    onSuccess: (lead) => {
      queryClient.setQueryData<Lead[]>(queryKey, (current) => [lead, ...(current ?? [])]);
    },
  });

  const updateMutation = useMutation<
    Lead,
    DataBackendError,
    { id: string; patch: Partial<NewLeadInput> },
    UpdateLeadMutationContext
  >({
    mutationFn: ({ id, patch }) => enqueueForLead(id, () => unwrap(repository.update(id, patch))),
    onMutate: async ({ id, patch }) => {
      // Cancel any in-flight list fetch first — without this, a
      // background refetch already running when the drag starts could
      // resolve AFTER the optimistic write below and silently overwrite
      // it with pre-drag server data.
      await queryClient.cancelQueries({ queryKey });
      pendingLeadUpdates.current += 1;

      const seq = (leadMutationSeq.current.get(id) ?? 0) + 1;
      leadMutationSeq.current.set(id, seq); // marks this as the latest attempt for THIS lead only
      const previousLead = queryClient.getQueryData<Lead[]>(queryKey)?.find((lead) => lead.id === id);
      queryClient.setQueryData<Lead[]>(queryKey, (current) =>
        (current ?? []).map((lead) => (lead.id === id ? { ...lead, ...patch } : lead))
      );
      return { id, seq, previousLead };
    },
    onError: (_err, _vars, context) => {
      if (!context?.previousLead) return;
      // Only revert if no newer mutation has started for this same lead
      // since this one began — an older failure must never clobber a
      // newer optimistic write or a newer success. Every OTHER lead in
      // the array is untouched regardless, since this only ever remaps
      // context.id.
      if (leadMutationSeq.current.get(context.id) !== context.seq) return;
      queryClient.setQueryData<Lead[]>(queryKey, (current) =>
        (current ?? []).map((lead) => (lead.id === context.id ? context.previousLead! : lead))
      );
    },
    onSettled: () => {
      pendingLeadUpdates.current -= 1;
      // Refetch only once every overlapping update has finished settling —
      // an earlier mutation settling while a later one is still in flight
      // must never trigger a refetch that could overwrite the later
      // mutation's still-pending optimistic write.
      if (pendingLeadUpdates.current === 0) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const deleteMutation = useMutation<void, DataBackendError, string>({
    mutationFn: (id) => unwrap(repository.delete(id)),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Lead[]>(queryKey, (current) => (current ?? []).filter((lead) => lead.id !== id));
    },
  });

  const loadDemoMutation = useMutation<Lead[], DataBackendError, NewLeadInput[]>({
    mutationFn: (inputs) => unwrap(repository.createDemoBatch(inputs)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const clearDemoMutation = useMutation<{ deletedCount: number }, DataBackendError, void>({
    mutationFn: () => unwrap(repository.clearAgencyDemoLeads()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isLoading = query.isLoading || scope.status === "loading";

  return {
    leads: query.data ?? [],
    leadsLoaded: !isLoading,
    isLoading,
    isError: query.isError || scope.status === "error",
    error: query.error ?? (scope.status === "error" ? scope.error : null),
    createLead: async (input) => {
      try {
        return { ok: true, data: await createMutation.mutateAsync(input) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    updateLead: async (id, patch) => {
      try {
        return { ok: true, data: await updateMutation.mutateAsync({ id, patch }) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    deleteLead: async (id) => {
      try {
        await deleteMutation.mutateAsync(id);
        return { ok: true, data: undefined };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    loadDemoLeads: async (inputs) => {
      try {
        return { ok: true, data: await loadDemoMutation.mutateAsync(inputs) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    clearDemoLeads: async () => {
      try {
        return { ok: true, data: await clearDemoMutation.mutateAsync() };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
  };
}
