"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import {
  CHART_AXIS_COLOR,
  CHART_COLORS,
  CHART_GRID_COLOR,
  CHART_SURFACE_COLOR,
  INSURANCE_TYPES,
} from "@/lib/constants";
import type { Policy } from "@/types";

export function PoliciesByTypeChart({ policies }: { policies: Policy[] }) {
  const data = INSURANCE_TYPES.map((type) => ({
    type,
    count: policies.filter((policy) => policy.product === type).length,
  }));

  return (
    <Card className="p-6">
      <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Policies by Type</p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20 }}>
            <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="type"
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={40}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: CHART_SURFACE_COLOR,
                border: "1px solid rgba(234,179,8,0.3)",
                borderRadius: 12,
                color: "#fff",
              }}
            />
            <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
