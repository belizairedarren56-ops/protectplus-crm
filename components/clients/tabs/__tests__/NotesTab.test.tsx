import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NotesTab } from "@/components/clients/tabs/NotesTab";
import { AccessScopeContext } from "@/hooks/useAccessScope";
import { DEMO_SCOPE } from "@/test-utils/renderWithProviders";

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
});
