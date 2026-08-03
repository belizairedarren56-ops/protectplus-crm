import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";

export type SupabaseConnectionConfig = { url: string; anonKey: string };

// Validated once, explicitly, before any Supabase client is ever
// constructed — no non-null assertions. A missing/empty value is a config
// error the caller can render a controlled screen for, not a low-level SDK
// throw from being handed `undefined`.
export function validateSupabaseConfig(): Result<SupabaseConnectionConfig, DataBackendError> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      ok: false,
      error: {
        kind: "config",
        message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set in supabase mode.",
      },
    };
  }

  return { ok: true, data: { url, anonKey } };
}
