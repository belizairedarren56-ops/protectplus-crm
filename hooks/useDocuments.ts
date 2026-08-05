"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { demoDocumentsRepository } from "@/lib/repositories/demoDocumentsRepository";
import {
  createDocumentsRepository,
  type DocumentsRepository,
  type NewDocumentInput,
} from "@/lib/repositories/documentsRepository";
import { unavailableDocumentsRepository } from "@/lib/repositories/unavailableDocumentsRepository";
import { unwrap, type Result } from "@/lib/result";
import type { Document } from "@/types";

export function documentsQueryKey(scope: AccessScope) {
  return [
    "documents",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ] as const;
}

function getDocumentsRepository(scope: AccessScope): DocumentsRepository {
  if (scope.status !== "ready") return unavailableDocumentsRepository;
  if (scope.backend === "demo") return demoDocumentsRepository;
  return createDocumentsRepository(scope.supabaseClient, scope.agencyId);
}

export type DocumentsApi = {
  documents: Document[];
  documentsLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
  error: DataBackendError | null;
  createDocument: (input: NewDocumentInput) => Promise<Result<Document, DataBackendError>>;
  updateDocument: (id: string, patch: Partial<NewDocumentInput>) => Promise<Result<Document, DataBackendError>>;
  deleteDocument: (id: string) => Promise<Result<void, DataBackendError>>;
  loadDemoDocuments: (inputs: NewDocumentInput[]) => Promise<Result<Document[], DataBackendError>>;
  clearDemoDocuments: () => Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

// Full-list-fetch, client-side filter by clientId — same continuity
// decision as every other still-per-scope entity (see the Phase 3B plan's
// Hook layer section). DocumentsTab needs no changes: it still receives a
// pre-filtered array prop from app/clients/[id]/page.tsx.
export function useDocuments(): DocumentsApi {
  const scope = useAccessScope();
  const repository = getDocumentsRepository(scope);
  const queryClient = useQueryClient();
  const queryKey = documentsQueryKey(scope);

  const query = useQuery<Document[], DataBackendError>({
    queryKey,
    queryFn: () => unwrap(repository.list()),
    enabled: scope.status === "ready",
  });

  const createMutation = useMutation<Document, DataBackendError, NewDocumentInput>({
    mutationFn: (input) => unwrap(repository.create(input)),
    onSuccess: (document) => {
      queryClient.setQueryData<Document[]>(queryKey, (current) => [document, ...(current ?? [])]);
    },
  });

  const updateMutation = useMutation<
    Document,
    DataBackendError,
    { id: string; patch: Partial<NewDocumentInput> }
  >({
    mutationFn: ({ id, patch }) => unwrap(repository.update(id, patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<Document[]>(queryKey, (current) =>
        (current ?? []).map((document) => (document.id === updated.id ? updated : document))
      );
    },
  });

  const deleteMutation = useMutation<void, DataBackendError, string>({
    mutationFn: (id) => unwrap(repository.delete(id)),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Document[]>(queryKey, (current) =>
        (current ?? []).filter((document) => document.id !== id)
      );
    },
  });

  const loadDemoMutation = useMutation<Document[], DataBackendError, NewDocumentInput[]>({
    mutationFn: (inputs) => unwrap(repository.createDemoBatch(inputs)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const clearDemoMutation = useMutation<{ deletedCount: number }, DataBackendError, void>({
    mutationFn: () => unwrap(repository.clearAgencyDemoDocuments()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isLoading = query.isLoading || scope.status === "loading";

  return {
    documents: query.data ?? [],
    documentsLoaded: !isLoading,
    isLoading,
    isError: query.isError || scope.status === "error",
    error: query.error ?? (scope.status === "error" ? scope.error : null),
    createDocument: async (input) => {
      try {
        return { ok: true, data: await createMutation.mutateAsync(input) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    updateDocument: async (id, patch) => {
      try {
        return { ok: true, data: await updateMutation.mutateAsync({ id, patch }) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    deleteDocument: async (id) => {
      try {
        await deleteMutation.mutateAsync(id);
        return { ok: true, data: undefined };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    loadDemoDocuments: async (inputs) => {
      try {
        return { ok: true, data: await loadDemoMutation.mutateAsync(inputs) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    clearDemoDocuments: async () => {
      try {
        return { ok: true, data: await clearDemoMutation.mutateAsync() };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
  };
}
