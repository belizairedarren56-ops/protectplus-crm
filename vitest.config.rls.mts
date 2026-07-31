import { defineConfig } from "vitest/config";

// Separate from vitest.config.mts on purpose: these tests hit a real local
// Postgres/Auth/PostgREST stack over the network (`supabase start`), not
// jsdom, and can be slower than the jsdom unit suite.
export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
