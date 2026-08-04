import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

function Probe() {
  return <div>probe-content</div>;
}

describe("Providers — hook order across a config-validity change (correction 4.1.9 / Rules of Hooks)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DATA_BACKEND;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("rerenders across valid demo config and invalid supabase config without a hook-order error", () => {
    process.env.NEXT_PUBLIC_DATA_BACKEND = "demo";

    const { rerender, getByText, queryByText } = render(
      <Providers>
        <Probe />
      </Providers>
    );
    expect(getByText("probe-content")).toBeInTheDocument();

    // Providers re-evaluates getDataBackend()/validateSupabaseConfig() fresh
    // every render (nothing memoized), so this genuinely exercises React
    // switching between mounting ConfiguredProviders and ConfigErrorScreen
    // within one already-rendered tree — exactly the scenario that would
    // throw "Rendered fewer/more hooks than expected" if Providers weren't
    // structured correctly (a hook-free gate delegating all state to a
    // conditionally-mounted child, never calling a hook itself).
    process.env.NEXT_PUBLIC_DATA_BACKEND = "supabase";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() =>
      rerender(
        <Providers>
          <Probe />
        </Providers>
      )
    ).not.toThrow();

    // Genuinely switched branches — the error screen replaced the probe,
    // proving this isn't a no-op rerender.
    expect(queryByText("probe-content")).not.toBeInTheDocument();

    // And back again — the reverse transition is equally safe.
    process.env.NEXT_PUBLIC_DATA_BACKEND = "demo";
    expect(() =>
      rerender(
        <Providers>
          <Probe />
        </Providers>
      )
    ).not.toThrow();
    expect(getByText("probe-content")).toBeInTheDocument();
  });
});
