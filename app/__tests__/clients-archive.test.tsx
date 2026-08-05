import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import ClientsPage from "@/app/clients/page";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import { STORAGE_KEYS, getItem } from "@/lib/storage";
import type { Client, Policy, Task } from "@/types";

const client: Client = {
  id: "1",
  firstName: "Jane",
  lastName: "Cooper",
  phone: "954-555-2222",
  email: "jane.cooper@example.com",
  policyType: "Auto",
  status: "Active",
};

const dependentPolicy: Policy = {
  id: 100,
  clientId: "1",
  clientName: "Jane Cooper",
  carrier: "State Farm",
  policyNumber: "SF-1000000",
  product: "Auto",
  effectiveDate: new Date().toISOString(),
  expirationDate: new Date().toISOString(),
  status: "Active",
  premium: 1200,
  producer: "Darren Belizaire",
};

const dependentTask: Task = {
  id: "200",
  title: "Follow up",
  assignedToName: "Darren Belizaire",
  priority: "Medium",
  dueDate: new Date().toISOString(),
  status: "Open",
  clientId: "1",
  clientName: "Jane Cooper",
};

function seed() {
  window.localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify([client]));
  window.localStorage.setItem(STORAGE_KEYS.policies, JSON.stringify([dependentPolicy]));
  window.localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify([dependentTask]));
}

describe("Clients page — archive/restore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetMigrationStateForTests();
    seed();
  });

  it("archiving a client hides it from the Active view but never touches dependent records", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);

    expect(await screen.findByText("Jane Cooper")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(screen.queryByText("Jane Cooper")).not.toBeInTheDocument());

    // No permanent-delete path exists — dependents must be untouched.
    // Both entities are still routed through the versioned local-data key
    // post-migration, not the untouched legacy key.
    expect(getItem<Policy[]>(`${STORAGE_KEYS.policies}@v2`, [])).toHaveLength(1);
    expect(getItem<Task[]>(`${STORAGE_KEYS.tasks}@v2`, [])).toHaveLength(1);

    const archivedClients = getItem<Client[]>(`${STORAGE_KEYS.clients}@v2`, []);
    expect(archivedClients).toHaveLength(1);
    expect(archivedClients[0].archivedAt).toBeTruthy();
  });

  it("an archived client can be restored back to the Active view", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);

    await user.click(await screen.findByRole("button", { name: "Archive" }));
    await waitFor(() => expect(screen.queryByText("Jane Cooper")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Archived/ }));
    const archivedRow = await screen.findByText("Jane Cooper");
    expect(archivedRow).toBeInTheDocument();

    const row = archivedRow.closest("tr");
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Restore" }));

    await user.click(screen.getByRole("button", { name: "Active" }));
    expect(await screen.findByText("Jane Cooper")).toBeInTheDocument();

    const restoredClients = getItem<Client[]>(`${STORAGE_KEYS.clients}@v2`, []);
    expect(restoredClients[0].archivedAt).toBeUndefined();
  });

  it("never renders a Delete action anywhere on the page", async () => {
    renderWithProviders(<ClientsPage />);
    await screen.findByText("Jane Cooper");

    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
  });
});
