"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { demoPoliciesRepository } from "@/lib/repositories/demoPoliciesRepository";
import {
  createPoliciesRepository,
  type NewPolicyInput,
  type PoliciesRepository,
} from "@/lib/repositories/policiesRepository";
import { unavailablePoliciesRepository } from "@/lib/repositories/unavailablePoliciesRepository";
import { unwrap, type Result } from "@/lib/result";
import type { Policy } from "@/types";

export function policiesQueryKey(scope: AccessScope) {
  return [
    "policies",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ] as const;
}

function getPoliciesRepository(scope: AccessScope): PoliciesRepository {
  if (scope.status !== "ready") return unavailablePoliciesRepository;
  if (scope.backend === "demo") return demoPoliciesRepository;
  return createPoliciesRepository(scope.supabaseClient, scope.agencyId);
}

export type PoliciesApi = {
  policies: Policy[];
  policiesLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
  error: DataBackendError | null;
  createPolicy: (input: NewPolicyInput) => Promise<Result<Policy, DataBackendError>>;
  updatePolicy: (id: string, patch: Partial<NewPolicyInput>) => Promise<Result<Policy, DataBackendError>>;
  deletePolicy: (id: string) => Promise<Result<void, DataBackendError>>;
  loadDemoPolicies: (inputs: NewPolicyInput[]) => Promise<Result<Policy[], DataBackendError>>;
  clearDemoPolicies: () => Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

// Full-list-fetch, client-side filter by clientId — same continuity
// decision as every other still-per-scope entity. PoliciesTab needs no
// changes: it still receives a pre-filtered array prop.
export function usePolicies(): PoliciesApi {
  const scope = useAccessScope();
  const repository = getPoliciesRepository(scope);
  const queryClient = useQueryClient();
  const queryKey = policiesQueryKey(scope);

  const query = useQuery<Policy[], DataBackendError>({
    queryKey,
    queryFn: () => unwrap(repository.list()),
    enabled: scope.status === "ready",
  });

  const createMutation = useMutation<Policy, DataBackendError, NewPolicyInput>({
    mutationFn: (input) => unwrap(repository.create(input)),
    onSuccess: (policy) => {
      queryClient.setQueryData<Policy[]>(queryKey, (current) => [policy, ...(current ?? [])]);
    },
  });

  const updateMutation = useMutation<Policy, DataBackendError, { id: string; patch: Partial<NewPolicyInput> }>({
    mutationFn: ({ id, patch }) => unwrap(repository.update(id, patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<Policy[]>(queryKey, (current) =>
        (current ?? []).map((policy) => (policy.id === updated.id ? updated : policy))
      );
    },
  });

  const deleteMutation = useMutation<void, DataBackendError, string>({
    mutationFn: (id) => unwrap(repository.delete(id)),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Policy[]>(queryKey, (current) => (current ?? []).filter((policy) => policy.id !== id));
    },
  });

  const loadDemoMutation = useMutation<Policy[], DataBackendError, NewPolicyInput[]>({
    mutationFn: (inputs) => unwrap(repository.createDemoBatch(inputs)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const clearDemoMutation = useMutation<{ deletedCount: number }, DataBackendError, void>({
    mutationFn: () => unwrap(repository.clearAgencyDemoPolicies()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isLoading = query.isLoading || scope.status === "loading";

  return {
    policies: query.data ?? [],
    policiesLoaded: !isLoading,
    isLoading,
    isError: query.isError || scope.status === "error",
    error: query.error ?? (scope.status === "error" ? scope.error : null),
    createPolicy: async (input) => {
      try {
        return { ok: true, data: await createMutation.mutateAsync(input) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    updatePolicy: async (id, patch) => {
      try {
        return { ok: true, data: await updateMutation.mutateAsync({ id, patch }) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    deletePolicy: async (id) => {
      try {
        await deleteMutation.mutateAsync(id);
        return { ok: true, data: undefined };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    loadDemoPolicies: async (inputs) => {
      try {
        return { ok: true, data: await loadDemoMutation.mutateAsync(inputs) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    clearDemoPolicies: async () => {
      try {
        return { ok: true, data: await clearDemoMutation.mutateAsync() };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
  };
}
