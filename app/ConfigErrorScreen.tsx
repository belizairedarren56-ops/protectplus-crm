import type { DataBackendError } from "@/lib/dataMode";

// Rendered directly by the config gate in app/providers.tsx — a controlled,
// explicit failure screen for "supabase mode selected but config is missing
// or invalid," reached via plain conditional rendering rather than a throw
// caught by an error boundary. See app/global-error.tsx for the narrower,
// separate case (an invalid NEXT_PUBLIC_DATA_BACKEND value itself, which
// throws before this component could ever render).
export function ConfigErrorScreen({ error }: { error: DataBackendError }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06080c] p-6 text-white">
      <div className="max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-400">Configuration error</p>
        <h1 className="mt-3 text-2xl font-black">Cannot start in Supabase mode</h1>
        <p className="mt-4 text-sm text-gray-300">{error.message}</p>
      </div>
    </div>
  );
}
