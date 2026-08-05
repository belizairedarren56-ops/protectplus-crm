"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { demoQuotesRepository } from "@/lib/repositories/demoQuotesRepository";
import {
  createQuotesRepository,
  type NewQuoteInput,
  type QuotesRepository,
} from "@/lib/repositories/quotesRepository";
import { unavailableQuotesRepository } from "@/lib/repositories/unavailableQuotesRepository";
import { unwrap, type Result } from "@/lib/result";
import type { Quote } from "@/types";

export function quotesQueryKey(scope: AccessScope) {
  return [
    "quotes",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ] as const;
}

function getQuotesRepository(scope: AccessScope): QuotesRepository {
  if (scope.status !== "ready") return unavailableQuotesRepository;
  if (scope.backend === "demo") return demoQuotesRepository;
  return createQuotesRepository(scope.supabaseClient, scope.agencyId);
}

export type QuotesApi = {
  quotes: Quote[];
  quotesLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
  error: DataBackendError | null;
  createQuote: (input: NewQuoteInput) => Promise<Result<Quote, DataBackendError>>;
  updateQuote: (id: string, patch: Partial<NewQuoteInput>) => Promise<Result<Quote, DataBackendError>>;
  deleteQuote: (id: string) => Promise<Result<void, DataBackendError>>;
  loadDemoQuotes: (inputs: NewQuoteInput[]) => Promise<Result<Quote[], DataBackendError>>;
  clearDemoQuotes: () => Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

// Full-list-fetch, client-side filter by clientId — same continuity
// decision as every other still-per-scope entity. QuotesTab needs no
// changes: it still receives a pre-filtered array prop.
export function useQuotes(): QuotesApi {
  const scope = useAccessScope();
  const repository = getQuotesRepository(scope);
  const queryClient = useQueryClient();
  const queryKey = quotesQueryKey(scope);

  const query = useQuery<Quote[], DataBackendError>({
    queryKey,
    queryFn: () => unwrap(repository.list()),
    enabled: scope.status === "ready",
  });

  const createMutation = useMutation<Quote, DataBackendError, NewQuoteInput>({
    mutationFn: (input) => unwrap(repository.create(input)),
    onSuccess: (quote) => {
      queryClient.setQueryData<Quote[]>(queryKey, (current) => [quote, ...(current ?? [])]);
    },
  });

  const updateMutation = useMutation<Quote, DataBackendError, { id: string; patch: Partial<NewQuoteInput> }>({
    mutationFn: ({ id, patch }) => unwrap(repository.update(id, patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<Quote[]>(queryKey, (current) =>
        (current ?? []).map((quote) => (quote.id === updated.id ? updated : quote))
      );
    },
  });

  const deleteMutation = useMutation<void, DataBackendError, string>({
    mutationFn: (id) => unwrap(repository.delete(id)),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Quote[]>(queryKey, (current) => (current ?? []).filter((quote) => quote.id !== id));
    },
  });

  const loadDemoMutation = useMutation<Quote[], DataBackendError, NewQuoteInput[]>({
    mutationFn: (inputs) => unwrap(repository.createDemoBatch(inputs)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const clearDemoMutation = useMutation<{ deletedCount: number }, DataBackendError, void>({
    mutationFn: () => unwrap(repository.clearAgencyDemoQuotes()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isLoading = query.isLoading || scope.status === "loading";

  return {
    quotes: query.data ?? [],
    quotesLoaded: !isLoading,
    isLoading,
    isError: query.isError || scope.status === "error",
    error: query.error ?? (scope.status === "error" ? scope.error : null),
    createQuote: async (input) => {
      try {
        return { ok: true, data: await createMutation.mutateAsync(input) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    updateQuote: async (id, patch) => {
      try {
        return { ok: true, data: await updateMutation.mutateAsync({ id, patch }) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    deleteQuote: async (id) => {
      try {
        await deleteMutation.mutateAsync(id);
        return { ok: true, data: undefined };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    loadDemoQuotes: async (inputs) => {
      try {
        return { ok: true, data: await loadDemoMutation.mutateAsync(inputs) };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
    clearDemoQuotes: async () => {
      try {
        return { ok: true, data: await clearDemoMutation.mutateAsync() };
      } catch (error) {
        return { ok: false, error: error as DataBackendError };
      }
    },
  };
}
