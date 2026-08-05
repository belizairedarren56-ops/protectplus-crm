import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import QuotesPage from "@/app/quotes/page";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import { STORAGE_KEYS, getItem } from "@/lib/storage";
import type { Client, Quote } from "@/types";

const client: Client = {
  id: "1",
  firstName: "Jane",
  lastName: "Cooper",
  phone: "954-555-2222",
  email: "jane.cooper@example.com",
  policyType: "Auto",
  status: "Active",
};

describe("Quotes page — modal state and client linkage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetMigrationStateForTests();
    window.localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify([client]));
  });

  it("does not leak a cancelled draft into the next 'New Quote' open", async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuotesPage />);

    await user.click(screen.getByRole("button", { name: "+ New Quote" }));
    const coverageInput = await screen.findByPlaceholderText("$350k dwelling / $100k liability");
    await user.type(coverageInput, "Should not persist");
    expect(coverageInput).toHaveValue("Should not persist");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "+ New Quote" }));
    const reopenedCoverageInput = await screen.findByPlaceholderText(
      "$350k dwelling / $100k liability"
    );
    expect(reopenedCoverageInput).toHaveValue("");
  });

  it("requires a real client and stamps the created quote with that client's id", async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuotesPage />);

    await user.click(screen.getByRole("button", { name: "+ New Quote" }));

    const clientSelect = await screen.findByRole("combobox", { name: "Client" });
    expect(clientSelect).toHaveValue(String(client.id));

    await user.click(screen.getByRole("button", { name: "Create Quote" }));

    let storedQuotes: Quote[] = [];
    await waitFor(() => {
      storedQuotes = getItem<Quote[]>(`${STORAGE_KEYS.quotes}@v3`, []);
      expect(storedQuotes).toHaveLength(1);
    });
    expect(storedQuotes[0].clientId).toBe(client.id);
    expect(storedQuotes[0].clientName).toBe("Jane Cooper");
  });

  it("shows an empty state instead of a form when there are no clients to link to", async () => {
    window.localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify([]));
    const user = userEvent.setup();
    renderWithProviders(<QuotesPage />);

    await user.click(screen.getByRole("button", { name: "+ New Quote" }));

    expect(await screen.findByText("No clients yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Quote" })).not.toBeInTheDocument();
  });
});
