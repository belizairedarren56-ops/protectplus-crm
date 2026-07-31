"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PRIORITY_BADGE_STYLES } from "@/lib/constants";
import type { Task } from "@/types";

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TaskCalendar({ tasks }: { tasks: Task[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = buildMonthGrid(year, month);
  const today = new Date();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-white">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            ‹
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            ›
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          const dayTasks = date
            ? tasks.filter((task) => sameDay(new Date(task.dueDate), date))
            : [];

          return (
            <div
              key={index}
              className={clsx(
                "min-h-24 rounded-lg border p-2 text-left align-top",
                date ? "border-white/10 bg-white/[0.02]" : "border-transparent",
                date && sameDay(date, today) && "border-yellow-400/60 bg-yellow-500/5"
              )}
            >
              {date && (
                <>
                  <p className="text-xs font-bold text-gray-400">{date.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {dayTasks.slice(0, 2).map((task) => (
                      <p
                        key={task.id}
                        className={clsx(
                          "truncate rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          PRIORITY_BADGE_STYLES[task.priority]
                        )}
                        title={task.title}
                      >
                        {task.title}
                      </p>
                    ))}
                    {dayTasks.length > 2 && (
                      <p className="text-[10px] text-gray-500">+{dayTasks.length - 2} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
