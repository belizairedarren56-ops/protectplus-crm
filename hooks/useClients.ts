"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import {
  createClientsRepository,
  type ClientsRepository,
  type NewClientInput,
} from "@/lib/repositories/clientsRepository";
import { demoClientsRepository } from "@/lib/repositories/demoClientsRepository";
import { unavailableClientsRepository } from "@/lib/repositories/unavailableClientsRepository";
import { unwrap, type Result } from "@/lib/result";
import type { Client } from "@/types";

export function clientsQueryKey(scope: AccessScope) {
  return [
    "clients",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ] as const;
}

// Plain function, not a hook — safe to call unconditionally from inside
// useClients() regardless of scope state. A non-ready scope routes to the
// unavailable repository, which refuses every read and write with a typed
// not-ready error rather than attempting anything.
function getClientsRepository(scope: AccessScope): ClientsRepository {
  if (scope.status !== "ready") return unavailableClientsRepository;
  if (scope.backend === "demo") return demoClientsRepository;
  return createClientsRepository(scope.supabaseClient);
}

export type ClientsApi = {
  clients: Client[];
  clientsLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
  error: DataBackendError | null;
  backend: AccessScope["backend"];
  createClient: (input: NewClientInput) => Promise<Result<Client, DataBackendError>>;
  updateClient: (id: string, patch: Partial<NewClientInput>) => Promise<Result<Client, DataBackendError>>;
  archiveClient: (id: string) => Promise<Result<Client, DataBackendError>>;
  restoreClient: (id: string) => Promise<Result<Client, DataBackendError>>;
  /** Demo Data "Load" — admin-only in `supabase` mode, gated by both RLS
   * (clients_insert's is_demo check) and the UI (see Settings page). */
  loadDemoClients: (inputs: NewClientInput[]) => Promise<Result<Client[], DataBackendError>>;
  /** Demo Data "Clear" — admin-only in `supabase` mode, backed by the
   * clear_agency_demo_clients() RPC. */
  clearDemoClients: () => Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

/**
 * One hook, always calling the same TanStack Query hooks in the same order
 * regardless of backend or scope state — only the repository object passed
 * as the query/mutation function is selected by the plain function above.
 * Both backends share one cache: every consumer of useClients() now reads
 * from the same query key instead of holding an independent local copy.
 */
export function useClients(): ClientsApi {
  const scope = useAccessScope();
  const repository = getClientsRepository(scope);
  const queryClient = useQueryClient();
  const queryKey = clientsQueryKey(scope);

  const query = useQuery<Client[], DataBackendError>({
    queryKey,
    queryFn: () => unwrap(repository.list()),
    enabled: scope.status === "ready",
  });

  const createMutation = useMutation<Client, DataBackendError, NewClientInput>({
    mutationFn: (input) => unwrap(repository.create(input)),
    onSuccess: (client) => {
      queryClient.setQueryData<Client[]>(queryKey, (current) => [client, ...(current ?? [])]);
    },
  });

  const updateMutation = useMutation<Client, DataBackendError, { id: string; patch: Partial<NewClientInput> }>({
    mutationFn: ({ id, patch }) => unwrap(repository.update(id, patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<Client[]>(queryKey, (current) =>
        (current ?? []).map((client) => (client.id === updated.id ? updated : client))
      );
    },
  });

  const archiveMutation = useMutation<Client, DataBackendError, string>({
    mutationFn: (id) => unwrap(repository.archive(id)),
    onSuccess: (archived) => {
      // Archived clients stay in the list (archivedAt now set) — the UI
      // filters Active vs. Archived client-side, exactly like every other
      // still-local entity's archive/restore flow. This is not a delete.
      queryClient.setQueryData<Client[]>(queryKey, (current) =>
        (current ?? []).map((client) => (client.id === archived.id ? archived : client))
      );
    },
  });

  const restoreMutation = useMutation<Client, DataBackendError, string>({
    mutationFn: (id) => unwrap(repository.restore(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const loadDemoMutation = useMutation<Client[], DataBackendError, NewClientInput[]>({
    mutationFn: (inputs) => unwrap(repository.createDemoBatch(inputs)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const clearDemoMutation = useMutation<{ deletedCount: number }, DataBackendError, void>({
    mutationFn: () => unwrap(repository.clearAgencyDemoClients()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isLoading = query.isLoading || scope.status === "loading";

  return {
    clients: query.data ?? [],
    clientsLoaded: !isLoading,
    isLoading,
    isError: query.isError || scope.status === "error",
    error: query.error ?? (scope.status === "error" ? scope.error : null),
    backend: scope.backend,
    createClient: async (input) => {
      try {
        return { ok: true, data: await createMutation.mutateAsync(input) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    updateClient: async (id, patch) => {
      try {
        return { ok: true, data: await updateMutation.mutateAsync({ id, patch }) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    archiveClient: async (id) => {
      try {
        return { ok: true, data: await archiveMutation.mutateAsync(id) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    restoreClient: async (id) => {
      try {
        return { ok: true, data: await restoreMutation.mutateAsync(id) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    loadDemoClients: async (inputs) => {
      try {
        return { ok: true, data: await loadDemoMutation.mutateAsync(inputs) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    clearDemoClients: async () => {
      try {
        return { ok: true, data: await clearDemoMutation.mutateAsync() };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
  };
}
