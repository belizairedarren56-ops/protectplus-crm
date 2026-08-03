"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccessScopeProvider, SupabaseClientProvider } from "@/app/AccessScopeProvider";
import type { DataBackend, DataBackendError } from "@/lib/dataMode";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseConnectionConfig } from "@/lib/supabase/config";

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const kind = (error as DataBackendError | undefined)?.kind;
  if (kind === "denied" || kind === "not_ready" || kind === "config") return false;
  return failureCount < 2;
}

/**
 * Owns every stateful piece: the QueryClient, the Supabase client, and the
 * contexts that expose them. Only ever mounted once config is known-good
 * (see app/providers.tsx) — both `useState` calls below run every render,
 * unconditionally; the backend branch lives inside the second one's lazy
 * initializer (plain JS), not around the hook call itself, so this
 * component never conditionally skips a hook between renders.
 */
export function ConfiguredProviders({
  backend,
  config,
  children,
}: {
  backend: DataBackend;
  config: SupabaseConnectionConfig | null;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetryQuery },
          mutations: { retry: false },
        },
      })
  );
  const [supabaseClient] = useState(() => (backend === "supabase" && config ? createClient(config) : null));

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseClientProvider value={supabaseClient}>
        <AccessScopeProvider backend={backend}>{children}</AccessScopeProvider>
      </SupabaseClientProvider>
    </QueryClientProvider>
  );
}
