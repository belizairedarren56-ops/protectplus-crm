import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Every test explicitly runs in Demo Mode by declared default, not by
// accident of an unset variable — individual test files override this to
// "supabase" where they specifically need that mode (matching the existing
// per-test process.env[...] toggle convention used elsewhere, e.g.
// documents-sensitive-folders.test.tsx).
beforeEach(() => {
  process.env.NEXT_PUBLIC_DATA_BACKEND = "demo";
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete process.env.NEXT_PUBLIC_DATA_BACKEND;
});
