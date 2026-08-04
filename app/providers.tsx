"use client";

import { ReactNode } from "react";
import { ConfigErrorScreen } from "@/app/ConfigErrorScreen";
import { ConfiguredProviders } from "@/app/ConfiguredProviders";
import { getDataBackend } from "@/lib/dataMode";
import { validateSupabaseConfig } from "@/lib/supabase/config";

/**
 * The hook-safe configuration gate. Calls ZERO hooks itself — only plain
 * functions (getDataBackend, validateSupabaseConfig) — so it can branch and
 * return early as many times as needed with no Rules-of-Hooks concern at
 * all. Every stateful piece (QueryClient, Supabase client, contexts) lives
 * one level down in ConfiguredProviders, which is only ever mounted once
 * config is known-good.
 */
export function Providers({ children }: { children: ReactNode }) {
  // Throws only in production with an unset/invalid NEXT_PUBLIC_DATA_BACKEND —
  // that narrower case is caught by app/global-error.tsx, the last-resort
  // net for a root-layout-level throw. This function call itself is not a
  // hook, so throwing here (rather than after some hooks have already run)
  // doesn't create any hook-order hazard.
  const backend = getDataBackend();

  if (backend === "demo") {
    return (
      <ConfiguredProviders backend={backend} config={null}>
        {children}
      </ConfiguredProviders>
    );
  }

  const configResult = validateSupabaseConfig();
  if (!configResult.ok) {
    // Rendered directly — no throw/catch involved, so this doesn't depend
    // on error-boundary placement at all (see app/global-error.tsx's own
    // comment on why that matters for a root-layout-level failure).
    return <ConfigErrorScreen error={configResult.error} />;
  }

  return (
    <ConfiguredProviders backend={backend} config={configResult.data}>
      {children}
    </ConfiguredProviders>
  );
}
