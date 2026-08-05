import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskModal } from "@/components/tasks/TaskModal";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import type { Task } from "@/types";

const okTask: Task = {
  id: "1",
  title: "Follow up",
  assignedToName: "Darren Belizaire",
  priority: "Medium",
  dueDate: "2026-01-01",
  status: "Open",
};

describe("TaskModal", () => {
  it("clears the form when cancelled, so the next open starts blank", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ ok: true, data: okTask });
    const onUpdate = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(<TaskModal open onClose={onClose} onCreate={onCreate} onUpdate={onUpdate} task={null} />);

    const title = screen.getByPlaceholderText("Follow up on renewal quote");
    await user.type(title, "Should Not Persist");
    expect(title).toHaveValue("Should Not Persist");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText("Follow up on renewal quote")).toHaveValue("");
  });

  it("clears the form when closed via the × button", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ ok: true, data: okTask });
    renderWithProviders(<TaskModal open onClose={vi.fn()} onCreate={onCreate} onUpdate={vi.fn()} task={null} />);

    const title = screen.getByPlaceholderText("Follow up on renewal quote");
    await user.type(title, "Temp Value");

    fireEvent.click(screen.getByText("×"));

    expect(screen.getByPlaceholderText("Follow up on renewal quote")).toHaveValue("");
  });

  it("submits a new task with the entered values via onCreate, not onUpdate", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ ok: true, data: okTask });
    const onUpdate = vi.fn();

    renderWithProviders(<TaskModal open onClose={vi.fn()} onCreate={onCreate} onUpdate={onUpdate} task={null} />);

    await user.type(screen.getByPlaceholderText("Follow up on renewal quote"), "Call client");
    await user.click(screen.getByRole("button", { name: "Create Task" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toMatchObject({ title: "Call client" });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("submits an edit via onUpdate with the task's id, not onCreate", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onUpdate = vi.fn().mockResolvedValue({ ok: true, data: okTask });

    renderWithProviders(<TaskModal open onClose={vi.fn()} onCreate={onCreate} onUpdate={onUpdate} task={okTask} />);

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toBe(okTask.id);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("shows an inline error and keeps the modal open when the save fails", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: "connection", message: "Could not reach Supabase." },
    });
    const onClose = vi.fn();

    renderWithProviders(<TaskModal open onClose={onClose} onCreate={onCreate} onUpdate={vi.fn()} task={null} />);

    await user.type(screen.getByPlaceholderText("Follow up on renewal quote"), "Call client");
    await user.click(screen.getByRole("button", { name: "Create Task" }));

    expect(await screen.findByText("Could not reach Supabase.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
