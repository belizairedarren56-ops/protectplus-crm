"use client"; // Error boundaries must be Client Components

// Last-resort net for a throw at the root-layout level (e.g.
// getDataBackend()'s production fail-closed throw when
// NEXT_PUBLIC_DATA_BACKEND is unset/invalid) — a normal, nested error.tsx
// cannot wrap the root layout itself, so Next.js requires this specific
// file for that case. Must define its own <html>/<body> since it replaces
// the root layout when active. Next.js 16 renamed the old `reset` prop to
// `unstable_retry` (confirmed against
// node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md
// — this project's own instruction to verify version-specific API shape
// rather than assume it matches older Next.js docs).
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#06080c] text-white">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-400">
              Configuration error
            </p>
            <h1 className="mt-3 text-2xl font-black">Something went wrong</h1>
            <p className="mt-4 text-sm text-gray-300">{error.message}</p>
            <button
              onClick={() => unstable_retry()}
              className="mt-6 rounded-xl border border-yellow-500/40 px-5 py-3 font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
