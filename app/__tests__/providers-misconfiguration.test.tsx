import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";

// AccessScopeProvider's UnauthenticatedGate calls usePathname()/useRouter()
// from next/navigation — outside a real Next.js App Router context (as in
// this Vitest/jsdom render), these need a minimal stub.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

describe("Providers — rendered config-error screen (correction 4.1.9)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DATA_BACKEND;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("renders a controlled error screen — not a crash, not the app's normal UI — when supabase mode is missing config", () => {
    process.env.NEXT_PUBLIC_DATA_BACKEND = "supabase";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    render(
      <Providers>
        <div>normal app content</div>
      </Providers>
    );

    expect(screen.getByText("Cannot start in Supabase mode")).toBeInTheDocument();
    expect(screen.queryByText("normal app content")).not.toBeInTheDocument();
  });

  it("renders normal app content in demo mode regardless of Supabase config", () => {
    process.env.NEXT_PUBLIC_DATA_BACKEND = "demo";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    render(
      <Providers>
        <div>normal app content</div>
      </Providers>
    );

    expect(screen.getByText("normal app content")).toBeInTheDocument();
  });

  it("renders normal app content in supabase mode when config is valid", () => {
    process.env.NEXT_PUBLIC_DATA_BACKEND = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    render(
      <Providers>
        <div>normal app content</div>
      </Providers>
    );

    expect(screen.getByText("normal app content")).toBeInTheDocument();
  });
});
