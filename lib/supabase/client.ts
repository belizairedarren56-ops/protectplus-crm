"use client";

import { createBrowserClient } from "@supabase/ssr";
import { validateSupabaseConfig, type SupabaseConnectionConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

// Browser-side Supabase client. Only ever uses the public URL + anon key —
// both are meant to be public and are safe in client bundles. The
// service-role key must never appear in any file imported from here.
//
// Accepts an already-validated config (ConfiguredProviders passes the
// config the Providers gate already validated, so it's never re-checked
// twice) or, called with no arguments, validates for itself — used by
// app/login/page.tsx, which needs a client before any provider-level scope
// exists. No non-null assertions either way: a missing config throws a
// clear, typed error rather than handing `createBrowserClient` `undefined`.
export function createClient(config?: SupabaseConnectionConfig) {
  let resolvedConfig: SupabaseConnectionConfig;

  if (config) {
    resolvedConfig = config;
  } else {
    const validated = validateSupabaseConfig();
    if (!validated.ok) throw new Error(validated.error.message);
    resolvedConfig = validated.data;
  }

  return createBrowserClient<Database>(resolvedConfig.url, resolvedConfig.anonKey);
}
