"use client";

import { useState } from "react";
import clsx from "clsx";
import { TaskCalendar } from "@/components/tasks/TaskCalendar";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskModal } from "@/components/tasks/TaskModal";
import { Button } from "@/components/ui/Button";
import { useTasks } from "@/hooks/useTasks";
import type { Task } from "@/types";

type ViewMode = "list" | "calendar";

export default function TasksPage() {
  const { tasks, setTasks, tasksLoaded } = useTasks();
  const [view, setView] = useState<ViewMode>("list");
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  // See app/quotes/page.tsx for why this exists — forces TaskModal to remount
  // on every open so a cancelled draft never survives to the next one.
  const [modalSession, setModalSession] = useState(0);

  const visibleTasks = showOpenOnly ? tasks.filter((task) => task.status === "Open") : tasks;

  function openNewTask() {
    setModalSession((session) => session + 1);
    setEditingTask(null);
  }

  function openEditTask(task: Task) {
    setModalSession((session) => session + 1);
    setEditingTask(task);
  }

  function saveTask(task: Task) {
    setTasks((current) => {
      const exists = current.some((item) => item.id === task.id);
      return exists ? current.map((item) => (item.id === task.id ? task : item)) : [task, ...current];
    });
  }

  function deleteTask(id: number) {
    if (!window.confirm("Delete this task?")) return;
    setTasks((current) => current.filter((item) => item.id !== id));
  }

  function toggleComplete(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, status: task.status === "Complete" ? "Open" : "Complete" } : task
      )
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
            ProtectPlus CRM
          </p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Tasks</h1>
          <p className="mt-2 text-gray-400">Follow-ups, renewals, and to-dos assigned to your team.</p>
        </div>

        <Button onClick={openNewTask}>+ New Task</Button>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 rounded-xl border border-yellow-500/20 bg-black/60 p-1">
          <button
            onClick={() => setView("list")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-bold transition",
              view === "list" ? "bg-yellow-500/20 text-yellow-300" : "text-gray-400 hover:text-gray-200"
            )}
          >
            List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-bold transition",
              view === "calendar" ? "bg-yellow-500/20 text-yellow-300" : "text-gray-400 hover:text-gray-200"
            )}
          >
            Calendar
          </button>
        </div>

        {view === "list" && (
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-400">
            <input
              type="checkbox"
              checked={showOpenOnly}
              onChange={(event) => setShowOpenOnly(event.target.checked)}
              className="h-4 w-4 accent-yellow-500"
            />
            Open tasks only
          </label>
        )}
      </div>

      <div className="mt-6">
        {!tasksLoaded ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 px-6 py-16 text-center text-gray-500">
            Loading tasks...
          </div>
        ) : view === "list" ? (
          <TaskList
            tasks={visibleTasks}
            onToggleComplete={toggleComplete}
            onEdit={openEditTask}
            onDelete={deleteTask}
          />
        ) : (
          <TaskCalendar tasks={visibleTasks} />
        )}
      </div>

      <TaskModal
        key={modalSession}
        open={editingTask !== undefined}
        onClose={() => setEditingTask(undefined)}
        onSave={saveTask}
        task={editingTask}
      />
    </div>
  );
}
