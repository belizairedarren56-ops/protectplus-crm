import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead, LeadStage } from "@/types";

// dnd-kit's pointer-sensor internals are impractical to exercise
// meaningfully through jsdom/RTL (see the Phase 3C plan) — the real drag
// gesture is proven end to end by the existing, unmodified
// e2e/lead-kanban.spec.ts. This mock replaces only the rendering/gesture
// layer with plain buttons that call the REAL page's onStageChange prop
// directly, so this test exercises the actual handleStageChange logic
// defined in app/leads/page.tsx, not a reimplementation of it.
vi.mock("@/components/leads/KanbanBoard", () => ({
  KanbanBoard: ({
    leads,
    onStageChange,
  }: {
    leads: Lead[];
    onStageChange: (leadId: string, stage: LeadStage) => void;
  }) => (
    <div>
      {leads.map((lead) => (
        <div key={lead.id}>
          <button onClick={() => onStageChange(lead.id, lead.stage)}>Drop {lead.clientName} into own column</button>
          <button onClick={() => onStageChange(lead.id, "Contacted")}>Drop {lead.clientName} into Contacted</button>
        </div>
      ))}
    </div>
  ),
}));

import LeadsPage from "@/app/leads/page";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import { demoLeadsRepository } from "@/lib/repositories/demoLeadsRepository";
import { STORAGE_KEYS } from "@/lib/storage";

const seededLead = {
  id: 1,
  clientName: "Jane Cooper",
  insuranceType: "Auto",
  stage: "New",
  producer: "Darren Belizaire",
  priority: "Medium",
  lastContact: "2026-01-01T00:00:00.000Z",
};

describe("Leads page — stage-change no-op guard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetMigrationStateForTests();
    window.localStorage.setItem(STORAGE_KEYS.leads, JSON.stringify([seededLead]));
    vi.restoreAllMocks();
  });

  it("dropping a lead into the stage it's already in never calls the repository or touches lastContact", async () => {
    const user = userEvent.setup();
    const updateSpy = vi.spyOn(demoLeadsRepository, "update");

    renderWithProviders(<LeadsPage />);

    const noOpButton = await screen.findByRole("button", { name: "Drop Jane Cooper into own column" });
    await user.click(noOpButton);

    // Give any (incorrect) async update a chance to fire before asserting.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("dropping a lead into a genuinely different stage calls the repository with the new stage and a fresh lastContact", async () => {
    const user = userEvent.setup();
    const updateSpy = vi.spyOn(demoLeadsRepository, "update");

    renderWithProviders(<LeadsPage />);

    const realChangeButton = await screen.findByRole("button", { name: "Drop Jane Cooper into Contacted" });
    await user.click(realChangeButton);

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    const [, patch] = updateSpy.mock.calls[0];
    expect(patch).toMatchObject({ stage: "Contacted" });
    expect(patch.lastContact).not.toBe(seededLead.lastContact);
  });
});
