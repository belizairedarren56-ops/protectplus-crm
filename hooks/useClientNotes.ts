"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { createClientNotesRepository, type ClientNotesRepository } from "@/lib/repositories/clientNotesRepository";
import { createDemoClientNotesRepository } from "@/lib/repositories/demoClientNotesRepository";
import { unavailableClientNotesRepository } from "@/lib/repositories/unavailableClientNotesRepository";
import { unwrap, type Result } from "@/lib/result";

// Keyed per-client (unlike clientsQueryKey and its siblings, which key on
// scope alone) — a note is fetched/upserted one client at a time from a
// single detail-page tab, never listed agency-wide. This also gives us,
// for free, the same "a clientId/scope change never shows the previous
// key's cached value" guarantee TanStack Query already provides for
// useClients() — no bespoke fingerprint-reset state needed here.
export function clientNotesQueryKey(clientId: string, scope: AccessScope) {
  return [
    "client-notes",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
    clientId,
  ] as const;
}

function getClientNotesRepository(scope: AccessScope): ClientNotesRepository {
  if (scope.status !== "ready") return unavailableClientNotesRepository;
  if (scope.backend === "demo") return createDemoClientNotesRepository(scope);
  return createClientNotesRepository(scope.supabaseClient);
}

export type ClientNotesApi = {
  note: string;
  loaded: boolean;
  isLoading: boolean;
  isError: boolean;
  error: DataBackendError | null;
  saveNote: (body: string) => Promise<Result<string, DataBackendError>>;
};

export function useClientNotes(clientId: string): ClientNotesApi {
  const scope = useAccessScope();
  const repository = getClientNotesRepository(scope);
  const queryClient = useQueryClient();
  const queryKey = clientNotesQueryKey(clientId, scope);

  const query = useQuery<string, DataBackendError>({
    queryKey,
    queryFn: () => unwrap(repository.getProfileNote(clientId)),
    enabled: scope.status === "ready",
  });

  const saveMutation = useMutation<string, DataBackendError, string>({
    mutationFn: (body) => unwrap(repository.saveProfileNote(clientId, body)),
    onSuccess: (body) => {
      queryClient.setQueryData<string>(queryKey, body);
    },
  });

  const isLoading = query.isLoading || scope.status === "loading";

  return {
    note: query.data ?? "",
    loaded: !isLoading,
    isLoading,
    isError: query.isError || scope.status === "error",
    error: query.error ?? (scope.status === "error" ? scope.error : null),
    saveNote: async (body) => {
      try {
        return { ok: true, data: await saveMutation.mutateAsync(body) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
  };
}
