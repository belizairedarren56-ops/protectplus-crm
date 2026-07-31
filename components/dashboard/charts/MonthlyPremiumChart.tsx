"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { CHART_AXIS_COLOR, CHART_COLORS, CHART_GRID_COLOR, CHART_SURFACE_COLOR } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { Policy } from "@/types";

function lastSixMonths(): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString("en-US", { month: "short" }),
    });
  }

  return months;
}

export function MonthlyPremiumChart({ policies }: { policies: Policy[] }) {
  const data = lastSixMonths().map(({ key, label }) => {
    const [year, month] = key.split("-").map(Number);
    const total = policies
      .filter((policy) => {
        const date = new Date(policy.effectiveDate);
        return date.getFullYear() === year && date.getMonth() === month;
      })
      .reduce((sum, policy) => sum + policy.premium, 0);

    return { label, total };
  });

  return (
    <Card className="p-6">
      <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Monthly Premium</p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -10 }}>
            <defs>
              <linearGradient id="premiumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.orange} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.orange} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                background: CHART_SURFACE_COLOR,
                border: "1px solid rgba(234,179,8,0.3)",
                borderRadius: 12,
                color: "#fff",
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={CHART_COLORS.orange}
              strokeWidth={2}
              fill="url(#premiumFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
