import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import type { Lead } from "@/types";

const okLead: Lead = {
  id: "1",
  clientName: "Jane Cooper",
  insuranceType: "Auto",
  stage: "New",
  assignedProducerName: "Darren Belizaire",
  priority: "Medium",
  lastContact: "2026-01-01T00:00:00.000Z",
};

describe("AddLeadModal", () => {
  it("clears the form when cancelled, so the next open starts blank", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ ok: true, data: okLead });
    const onClose = vi.fn();

    renderWithProviders(<AddLeadModal open onClose={onClose} onCreate={onCreate} />);

    const clientName = screen.getByPlaceholderText("Jane Cooper");
    await user.type(clientName, "Should Not Persist");
    expect(clientName).toHaveValue("Should Not Persist");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText("Jane Cooper")).toHaveValue("");
  });

  it("clears the form when closed via the × button", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ ok: true, data: okLead });
    renderWithProviders(<AddLeadModal open onClose={vi.fn()} onCreate={onCreate} />);

    const clientName = screen.getByPlaceholderText("Jane Cooper");
    await user.type(clientName, "Temp Value");

    fireEvent.click(screen.getByText("×"));

    expect(screen.getByPlaceholderText("Jane Cooper")).toHaveValue("");
  });

  it("submits a new lead with the entered values via onCreate", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ ok: true, data: okLead });

    renderWithProviders(<AddLeadModal open onClose={vi.fn()} onCreate={onCreate} />);

    await user.type(screen.getByPlaceholderText("Jane Cooper"), "Maria Gonzalez");
    await user.click(screen.getByRole("button", { name: "Save Lead" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toMatchObject({ clientName: "Maria Gonzalez", stage: "New" });
    // No client picker — clientId is never set by this modal.
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty("clientId");
  });

  it("shows an inline error and keeps the modal open when the save fails", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: "connection", message: "Could not reach Supabase." },
    });
    const onClose = vi.fn();

    renderWithProviders(<AddLeadModal open onClose={onClose} onCreate={onCreate} />);

    await user.type(screen.getByPlaceholderText("Jane Cooper"), "Maria Gonzalez");
    await user.click(screen.getByRole("button", { name: "Save Lead" }));

    expect(await screen.findByText("Could not reach Supabase.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
