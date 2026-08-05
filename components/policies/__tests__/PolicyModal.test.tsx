import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolicyModal } from "@/components/policies/PolicyModal";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Client, Policy } from "@/types";

// Regression coverage for the Supabase CI failure this fix addresses: the
// database's effective_date < expiration_date CHECK constraint rejected
// every new policy, because the form previously defaulted both dates to
// today.

const client: Client = {
  id: "1",
  firstName: "Jane",
  lastName: "Cooper",
  phone: "954-555-2222",
  email: "jane.cooper@example.com",
  policyType: "Auto",
  status: "Active",
};

const okPolicy: Policy = {
  id: "1",
  clientId: "1",
  clientName: "Jane Cooper",
  carrier: "State Farm",
  policyNumber: "SF-1000000",
  product: "Auto",
  effectiveDate: "2026-01-01",
  expirationDate: "2026-07-01",
  status: "Active",
  premium: 1200,
  assignedProducerName: "Darren Belizaire",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneYearFromTodayIso(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function renderModal(onCreate = vi.fn().mockResolvedValue({ ok: true, data: okPolicy })) {
  return {
    onCreate,
    ...renderWithProviders(
      <PolicyModal open onClose={vi.fn()} onCreate={onCreate} onUpdate={vi.fn()} policy={null} />
    ),
  };
}

describe("PolicyModal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetMigrationStateForTests();
    window.localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify([client]));
  });

  it("defaults a new policy's effective date to today and expiration date to one year out", async () => {
    renderModal();

    const effectiveInput = await screen.findByLabelText("Effective Date");
    const expirationInput = screen.getByLabelText("Expiration Date");

    expect(effectiveInput).toHaveValue(todayIso());
    expect(expirationInput).toHaveValue(oneYearFromTodayIso());
  });

  it("the valid defaults submit cleanly, satisfying the database's effective_date < expiration_date constraint", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    const policyNumberInput = await screen.findByPlaceholderText("SF-1234567");
    await user.type(policyNumberInput, "SF-9999999");
    await user.click(screen.getByRole("button", { name: "Add Policy" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const submitted = onCreate.mock.calls[0][0];
    expect(submitted.effectiveDate < submitted.expirationDate).toBe(true);
  });

  it("blocks submission and shows an accessible inline error when expiration is not after effective", async () => {
    const { onCreate } = renderModal();

    const effectiveInput = await screen.findByLabelText("Effective Date");
    const expirationInput = screen.getByLabelText("Expiration Date");

    fireEvent.change(effectiveInput, { target: { value: "2026-06-01" } });
    fireEvent.change(expirationInput, { target: { value: "2026-06-01" } }); // same date — not strictly after

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Expiration date must be after the effective date.");
    expect(expirationInput).toHaveAttribute("aria-invalid", "true");
    expect(expirationInput).toHaveAttribute("aria-describedby", error.id);

    const submitButton = screen.getByRole("button", { name: "Add Policy" });
    expect(submitButton).toBeDisabled();

    // Even a direct form submit (bypassing the disabled button) must not
    // call onCreate — handleSubmit's own guard is what actually prevents
    // the write, not just the disabled attribute.
    fireEvent.submit(submitButton.closest("form")!);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("re-enables submission once an invalid range is corrected", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    const effectiveInput = await screen.findByLabelText("Effective Date");
    const expirationInput = screen.getByLabelText("Expiration Date");
    await user.type(screen.getByPlaceholderText("SF-1234567"), "SF-9999999");

    fireEvent.change(effectiveInput, { target: { value: "2026-06-01" } });
    fireEvent.change(expirationInput, { target: { value: "2026-01-01" } }); // before effective — worse than equal
    expect(screen.getByRole("button", { name: "Add Policy" })).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(expirationInput, { target: { value: "2026-07-01" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const submitButton = screen.getByRole("button", { name: "Add Policy" });
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      effectiveDate: "2026-06-01",
      expirationDate: "2026-07-01",
    });
  });
});
