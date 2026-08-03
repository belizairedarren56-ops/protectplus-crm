import { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccessScopeContext, type AccessScope } from "@/hooks/useAccessScope";

export const DEMO_SCOPE: AccessScope = {
  status: "ready",
  backend: "demo",
  agencyId: null,
  userId: null,
  role: null,
};

// A fresh QueryClient per render — no retries (tests want failures to
// surface immediately, not after TanStack Query's default backoff), no
// caching across renders in the same test.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  {
    scope = DEMO_SCOPE,
    queryClient = createTestQueryClient(),
    ...options
  }: { scope?: AccessScope; queryClient?: QueryClient } & Omit<RenderOptions, "wrapper"> = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AccessScopeContext.Provider value={scope}>{children}</AccessScopeContext.Provider>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}
