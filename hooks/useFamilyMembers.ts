"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { demoFamilyMembersRepository } from "@/lib/repositories/demoFamilyMembersRepository";
import {
  createFamilyMembersRepository,
  type FamilyMembersRepository,
  type NewFamilyMemberInput,
} from "@/lib/repositories/familyMembersRepository";
import { unavailableFamilyMembersRepository } from "@/lib/repositories/unavailableFamilyMembersRepository";
import { unwrap, type Result } from "@/lib/result";
import type { FamilyMember } from "@/types";

export function familyMembersQueryKey(scope: AccessScope) {
  return [
    "family-members",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ] as const;
}

function getFamilyMembersRepository(scope: AccessScope): FamilyMembersRepository {
  if (scope.status !== "ready") return unavailableFamilyMembersRepository;
  if (scope.backend === "demo") return demoFamilyMembersRepository;
  return createFamilyMembersRepository(scope.supabaseClient, scope.agencyId);
}

export type FamilyMembersApi = {
  familyMembers: FamilyMember[];
  familyMembersLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
  error: DataBackendError | null;
  createFamilyMember: (input: NewFamilyMemberInput) => Promise<Result<FamilyMember, DataBackendError>>;
  updateFamilyMember: (
    id: string,
    patch: Partial<NewFamilyMemberInput>
  ) => Promise<Result<FamilyMember, DataBackendError>>;
  deleteFamilyMember: (id: string) => Promise<Result<void, DataBackendError>>;
};

// Full-list-fetch, client-side filter by clientId — same deliberate
// continuity decision as usePolicies/useQuotes/useTasks/useDocuments (see
// the Phase 3B plan's Hook layer section): one shared cache per scope,
// FamilyTab receives a pre-filtered array prop exactly like every sibling
// tab.
export function useFamilyMembers(): FamilyMembersApi {
  const scope = useAccessScope();
  const repository = getFamilyMembersRepository(scope);
  const queryClient = useQueryClient();
  const queryKey = familyMembersQueryKey(scope);

  const query = useQuery<FamilyMember[], DataBackendError>({
    queryKey,
    queryFn: () => unwrap(repository.list()),
    enabled: scope.status === "ready",
  });

  const createMutation = useMutation<FamilyMember, DataBackendError, NewFamilyMemberInput>({
    mutationFn: (input) => unwrap(repository.create(input)),
    onSuccess: (member) => {
      queryClient.setQueryData<FamilyMember[]>(queryKey, (current) => [member, ...(current ?? [])]);
    },
  });

  const updateMutation = useMutation<
    FamilyMember,
    DataBackendError,
    { id: string; patch: Partial<NewFamilyMemberInput> }
  >({
    mutationFn: ({ id, patch }) => unwrap(repository.update(id, patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<FamilyMember[]>(queryKey, (current) =>
        (current ?? []).map((member) => (member.id === updated.id ? updated : member))
      );
    },
  });

  const deleteMutation = useMutation<void, DataBackendError, string>({
    mutationFn: (id) => unwrap(repository.delete(id)),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<FamilyMember[]>(queryKey, (current) =>
        (current ?? []).filter((member) => member.id !== id)
      );
    },
  });

  const isLoading = query.isLoading || scope.status === "loading";

  return {
    familyMembers: query.data ?? [],
    familyMembersLoaded: !isLoading,
    isLoading,
    isError: query.isError || scope.status === "error",
    error: query.error ?? (scope.status === "error" ? scope.error : null),
    createFamilyMember: async (input) => {
      try {
        return { ok: true, data: await createMutation.mutateAsync(input) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    updateFamilyMember: async (id, patch) => {
      try {
        return { ok: true, data: await updateMutation.mutateAsync({ id, patch }) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    deleteFamilyMember: async (id) => {
      try {
        await deleteMutation.mutateAsync(id);
        return { ok: true, data: undefined };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
  };
}
