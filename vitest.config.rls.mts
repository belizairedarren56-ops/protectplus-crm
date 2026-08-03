import { defineConfig } from "vitest/config";

// Separate from vitest.config.mts on purpose: every test in this suite hits
// a real local Postgres/Auth/PostgREST stack over the network
// (`supabase start`), not jsdom, and can be slower than the jsdom unit
// suite. Broadened beyond just `tests/rls` (Phase 2's RLS/isolation suite)
// to also cover `tests/repositories` (Phase 3A's repository integration
// tests) — both need the identical real-network, Node-environment runtime,
// so they share this one config rather than duplicating it.
export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/rls/**/*.test.ts", "tests/repositories/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
