import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessScopeProvider, SupabaseClientProvider } from "@/app/AccessScopeProvider";
import { createTestQueryClient } from "@/test-utils/renderWithProviders";

let pathname = "/clients";
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn() }),
}));

// A minimal mock Supabase client — enough for AccessScopeProvider's auth
// listener + (unreached, since session is null) profile query.
function createMockSupabaseClient() {
  return {
    auth: {
      onAuthStateChange: (callback: (event: string, session: null) => void) => {
        queueMicrotask(() => callback("INITIAL_SESSION", null));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function renderGated(children: React.ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SupabaseClientProvider value={createMockSupabaseClient()}>
        <AccessScopeProvider backend="supabase">{children}</AccessScopeProvider>
      </SupabaseClientProvider>
    </QueryClientProvider>
  );
}

describe("UnauthenticatedGate (correction 4.1.6 / 4.2.1)", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("hides protected content and redirects to /login on a protected route", async () => {
    pathname = "/clients";
    renderGated(<div>protected content</div>);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders the login page's own content normally — no redirect — when already on /login", async () => {
    pathname = "/login";
    renderGated(<div>login page content</div>);

    await waitFor(() => expect(screen.getByText("login page content")).toBeInTheDocument());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
