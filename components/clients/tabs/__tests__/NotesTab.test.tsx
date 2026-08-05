import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotesTab } from "@/components/clients/tabs/NotesTab";
import { AccessScopeContext, type AccessScope } from "@/hooks/useAccessScope";
import type { Database } from "@/lib/supabase/database.types";
import { DEMO_SCOPE, createTestQueryClient } from "@/test-utils/renderWithProviders";

// A minimal chainable fake matching exactly the
// .from("client_notes").select("body").eq(...).eq(...).maybeSingle() call
// shape clientNotesRepository.getProfileNote() makes — resolves as "no row
// yet", the same as a fresh client in a real database.
function createFakeSupabaseClient(): SupabaseClient<Database> {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  return { from: () => builder } as unknown as SupabaseClient<Database>;
}

const SUPABASE_SCOPE: AccessScope = {
  status: "ready",
  backend: "supabase",
  agencyId: "agency-b",
  userId: "user-b",
  role: "producer",
  supabaseClient: createFakeSupabaseClient(),
};

function renderNotes(clientId: string, scope: AccessScope, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AccessScopeContext.Provider value={scope}>
        <NotesTab clientId={clientId} />
      </AccessScopeContext.Provider>
    </QueryClientProvider>
  );
}

describe("NotesTab", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("protectplus-client-notes-client-a", "Client A's private note");
    window.localStorage.setItem("protectplus-client-notes-client-b", "Client B's private note");
  });

  it("loads the correct client's note content", async () => {
    const queryClient = createTestQueryClient();
    renderNotes("client-a", DEMO_SCOPE, queryClient);
    await waitFor(() => expect(screen.getByDisplayValue("Client A's private note")).toBeInTheDocument());
  });

  it("switching clients never shows the previous client's note text, not even for one render", async () => {
    const queryClient = createTestQueryClient();
    const { rerender } = renderNotes("client-a", DEMO_SCOPE, queryClient);
    await waitFor(() => expect(screen.getByDisplayValue("Client A's private note")).toBeInTheDocument());

    rerender(
      <QueryClientProvider client={queryClient}>
        <AccessScopeContext.Provider value={DEMO_SCOPE}>
          <NotesTab clientId="client-b" />
        </AccessScopeContext.Provider>
      </QueryClientProvider>
    );

    // Immediately after the rerender, before the new (clientId-keyed) query
    // has had any chance to settle — there is no cache entry for
    // "client-b" yet, so the component is in its loading state, never
    // showing client A's leftover text.
    expect(screen.queryByDisplayValue("Client A's private note")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByDisplayValue("Client B's private note")).toBeInTheDocument());
  });

  it("switching scope for the SAME clientId never shows the previous scope's note text", async () => {
    const queryClient = createTestQueryClient();
    const { rerender } = renderNotes("client-a", DEMO_SCOPE, queryClient);
    await waitFor(() => expect(screen.getByDisplayValue("Client A's private note")).toBeInTheDocument());

    rerender(
      <QueryClientProvider client={queryClient}>
        <AccessScopeContext.Provider value={SUPABASE_SCOPE}>
          <NotesTab clientId="client-a" />
        </AccessScopeContext.Provider>
      </QueryClientProvider>
    );

    // Same clientId in both scopes, on purpose — proves the query key
    // includes the full scope identity, not just clientId, since demo mode
    // and supabase mode resolve to entirely different storage for the same
    // clientId.
    expect(screen.queryByDisplayValue("Client A's private note")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText(/Loading notes/)).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("Client A's private note")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("shows an error state when the note fails to load", async () => {
    const queryClient = createTestQueryClient();
    const throwingScope: AccessScope = {
      status: "ready",
      backend: "supabase",
      agencyId: "agency-c",
      userId: "user-c",
      role: "producer",
      supabaseClient: {} as unknown as SupabaseClient<Database>, // .from is not a function
    };
    renderNotes("client-a", throwingScope, queryClient);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
