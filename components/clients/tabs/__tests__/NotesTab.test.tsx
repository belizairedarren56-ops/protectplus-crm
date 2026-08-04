import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NotesTab } from "@/components/clients/tabs/NotesTab";
import { AccessScopeContext, type AccessScope } from "@/hooks/useAccessScope";
import type { Database } from "@/lib/supabase/database.types";
import { DEMO_SCOPE } from "@/test-utils/renderWithProviders";

const SUPABASE_SCOPE: AccessScope = {
  status: "ready",
  backend: "supabase",
  agencyId: "agency-b",
  userId: "user-b",
  role: "producer",
  supabaseClient: {} as unknown as SupabaseClient<Database>,
};

function renderNotes(clientId: string) {
  return render(
    <AccessScopeContext.Provider value={DEMO_SCOPE}>
      <NotesTab clientId={clientId} />
    </AccessScopeContext.Provider>
  );
}

describe("NotesTab (correction 4.2.3)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("protectplus-client-notes-client-a", "Client A's private note");
    window.localStorage.setItem("protectplus-client-notes-client-b", "Client B's private note");
  });

  it("loads the correct client's note content", async () => {
    renderNotes("client-a");
    await waitFor(() => expect(screen.getByDisplayValue("Client A's private note")).toBeInTheDocument());
  });

  it("switching clients never shows the previous client's note text, not even for one render", async () => {
    const { rerender } = renderNotes("client-a");
    await waitFor(() => expect(screen.getByDisplayValue("Client A's private note")).toBeInTheDocument());

    rerender(
      <AccessScopeContext.Provider value={DEMO_SCOPE}>
        <NotesTab clientId="client-b" />
      </AccessScopeContext.Provider>
    );

    // Immediately after the rerender — before any effect flushes — the
    // fingerprint guard must already have reset away from client A's text.
    expect(screen.queryByDisplayValue("Client A's private note")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByDisplayValue("Client B's private note")).toBeInTheDocument());
  });

  it("switching scope for the SAME clientId never shows the previous scope's note text", async () => {
    // Same clientId in both scopes, on purpose — proves the reset is keyed
    // on the full scope fingerprint (entity + backend + identity), not just
    // clientId, since demo mode and supabase mode resolve to entirely
    // different storage keys for the same clientId (see
    // lib/scopedStorage.ts's resolveClientNotesKey).
    const { rerender } = renderNotes("client-a");
    await waitFor(() => expect(screen.getByDisplayValue("Client A's private note")).toBeInTheDocument());

    rerender(
      <AccessScopeContext.Provider value={SUPABASE_SCOPE}>
        <NotesTab clientId="client-a" />
      </AccessScopeContext.Provider>
    );

    // Immediately after the rerender — before any effect flushes — the
    // fingerprint guard must already have reset away from demo scope's text.
    expect(screen.queryByDisplayValue("Client A's private note")).not.toBeInTheDocument();

    // Settles into supabase scope's own (empty, nothing stored yet) key —
    // never demo scope's content.
    await waitFor(() => expect(screen.queryByText(/Loading notes/)).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("Client A's private note")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
