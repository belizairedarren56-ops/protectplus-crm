import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NotesTab } from "@/components/clients/tabs/NotesTab";
import { AccessScopeContext, type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import { useClients } from "@/hooks/useClients";
import { useLocalStorageList } from "@/hooks/useLocalStorageList";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import type { Database } from "@/lib/supabase/database.types";
import { createTestQueryClient } from "@/test-utils/renderWithProviders";

// Renders a small tree exercising every scoped-data mechanism this app has —
// clients (via useClients()/TanStack Query), leads and notifications (via
// useLocalStorageList), and notes (via NotesTab's own resolver) — under one
// scope, then rerenders directly to a different scope. None of the first
// scope's data may be visible under the second, not even for a single
// render before effects flush. useClients()/TanStack Query is included as a
// CONFIRMING test, not a new fix: a queryKey change (guaranteed by
// clientsQueryKey(scope) on any scope change) already returns no data for a
// never-before-seen key rather than the previous key's cached value — this
// proves that holds in practice. useLocalStorageList and NotesTab are each
// already covered individually elsewhere; this suite proves the guarantee
// holds when they're all switching together in one real tree, which is what
// an actual page (e.g. the client detail page) does.

const SCOPE_A: AccessScope = { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };
const SCOPE_B: AccessScope = {
  status: "ready",
  backend: "supabase",
  agencyId: "agency-b",
  userId: "user-b",
  role: "producer",
  supabaseClient: {} as unknown as SupabaseClient<Database>,
};

type LeadLike = { id: string; label: string };

function Inner() {
  const scope = useAccessScope();
  const { clients } = useClients();
  const leads = useLocalStorageList<LeadLike>("leads", scope);
  const notifications = useLocalStorageList<LeadLike>("notifications", scope);

  return (
    <div>
      <div data-testid="clients">{clients.map((c) => c.firstName).join(",")}</div>
      <div data-testid="leads">{leads.items.map((l) => l.label).join(",")}</div>
      <div data-testid="notifications">{notifications.items.map((n) => n.label).join(",")}</div>
      <NotesTab clientId="client-1" />
    </div>
  );
}

function Tree({ scope }: { scope: AccessScope }) {
  return (
    <AccessScopeContext.Provider value={scope}>
      <Inner />
    </AccessScopeContext.Provider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  __resetMigrationStateForTests();
});

describe("scope switch — no data leaks across a direct rerender, across every scoped mechanism at once", () => {
  it("clients, leads, notifications, and notes all reset on the same render as the scope change", async () => {
    window.localStorage.setItem(
      "protectplus-clients",
      JSON.stringify([
        { id: 1, firstName: "Alice", lastName: "ScopeA", phone: "", email: "", policyType: "Auto", status: "New Lead" },
      ])
    );
    window.localStorage.setItem("protectplus-leads", JSON.stringify([{ id: "1", label: "ScopeALead" }]));
    window.localStorage.setItem("protectplus-quotes", JSON.stringify([]));
    window.localStorage.setItem("protectplus-policies", JSON.stringify([]));
    window.localStorage.setItem("protectplus-tasks", JSON.stringify([]));
    window.localStorage.setItem("protectplus-documents", JSON.stringify([]));
    window.localStorage.setItem(
      "protectplus-notifications",
      JSON.stringify([{ id: "1", label: "ScopeANotif" }])
    );
    window.localStorage.setItem("protectplus-client-notes-client-1", "Scope A note");

    const queryClient = createTestQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <Tree scope={SCOPE_A} />
      </QueryClientProvider>
    );

    // Confirm scope A's data is genuinely loaded first — not trivially
    // empty from the start, which would make the later assertions vacuous.
    await waitFor(() => {
      expect(screen.getByTestId("clients")).toHaveTextContent("Alice");
      expect(screen.getByTestId("leads")).toHaveTextContent("ScopeALead");
      expect(screen.getByTestId("notifications")).toHaveTextContent("ScopeANotif");
      expect(screen.getByRole("textbox")).toHaveValue("Scope A note");
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <Tree scope={SCOPE_B} />
      </QueryClientProvider>
    );

    // Immediately after the rerender — before any further effect flush —
    // scope A's data must already be gone from every one of these. (Each
    // mechanism's own render-time fingerprint reset is what guarantees
    // this; RTL's rerender() itself already flushes the synchronous render
    // pass these resets happen in.)
    expect(screen.getByTestId("clients")).toHaveTextContent("");
    expect(screen.getByTestId("leads")).toHaveTextContent("");
    expect(screen.getByTestId("notifications")).toHaveTextContent("");
    expect(screen.queryByDisplayValue("Scope A note")).not.toBeInTheDocument();

    // And scope B's own (empty/error) state settles without ever having
    // shown scope A's content along the way.
    await waitFor(() => {
      expect(screen.getByTestId("leads")).toHaveTextContent("");
      expect(screen.getByTestId("notifications")).toHaveTextContent("");
    });
    expect(screen.getByTestId("clients")).toHaveTextContent("");
    expect(screen.queryByDisplayValue("Scope A note")).not.toBeInTheDocument();

    // Scope A's own legacy/versioned keys are untouched by anything that
    // happened after the switch.
    expect(window.localStorage.getItem("protectplus-client-notes-client-1")).toBe("Scope A note");
  });
});
