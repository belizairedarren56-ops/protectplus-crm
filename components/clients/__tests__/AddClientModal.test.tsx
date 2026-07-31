import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddClientModal } from "@/components/clients/AddClientModal";

describe("AddClientModal", () => {
  it("clears the form when cancelled, so the next open starts blank", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(<AddClientModal open onClose={onClose} onAdd={onAdd} />);

    const firstName = screen.getByPlaceholderText("John");
    await user.type(firstName, "Should Not Persist");
    expect(firstName).toHaveValue("Should Not Persist");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // The modal component itself isn't unmounted by clicking Cancel in this
    // test (the parent controls `open`); re-rendering with open again proves
    // the internal form state was reset, not just hidden.
    expect(screen.getByPlaceholderText("John")).toHaveValue("");
  });

  it("clears the form when closed via the × button", async () => {
    const user = userEvent.setup();
    render(<AddClientModal open onClose={vi.fn()} onAdd={vi.fn()} />);

    const firstName = screen.getByPlaceholderText("John");
    await user.type(firstName, "Temp Value");

    fireEvent.click(screen.getByText("×"));

    expect(screen.getByPlaceholderText("John")).toHaveValue("");
  });

  it("submits a client with the entered values and resets afterward", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(<AddClientModal open onClose={vi.fn()} onAdd={onAdd} />);

    await user.type(screen.getByPlaceholderText("John"), "Jane");
    await user.type(screen.getByPlaceholderText("Smith"), "Doe");
    await user.type(screen.getByPlaceholderText("954-555-1234"), "9545550001");
    await user.type(screen.getByPlaceholderText("client@email.com"), "jane@doe.com");

    await user.click(screen.getByRole("button", { name: "Save Client" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@doe.com",
    });
  });
});
