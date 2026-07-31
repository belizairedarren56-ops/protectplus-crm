"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CHART_COLORS } from "@/lib/constants";
import type { Policy } from "@/types";

function nextSixMonths(): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    });
  }

  return months;
}

export function RenewalCalendar({ policies }: { policies: Policy[] }) {
  const counts = nextSixMonths().map(({ key, label }) => {
    const [year, month] = key.split("-").map(Number);
    const count = policies.filter((policy) => {
      const date = new Date(policy.expirationDate);
      return date.getFullYear() === year && date.getMonth() === month;
    }).length;

    return { label, count };
  });

  const max = Math.max(1, ...counts.map((item) => item.count));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Renewal Calendar</p>
        <Link href="/policies" className="text-xs font-bold text-yellow-400 hover:text-yellow-300">
          View Policies
        </Link>
      </div>

      {policies.length === 0 ? (
        <EmptyState icon="📅" title="No upcoming renewals" />
      ) : (
        <div className="mt-5 space-y-3">
          {counts.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-400">{item.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.count / max) * 100}%`,
                    backgroundColor: CHART_COLORS.yellow,
                  }}
                />
              </div>
              <span className="w-6 text-right text-xs font-bold text-gray-300">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
