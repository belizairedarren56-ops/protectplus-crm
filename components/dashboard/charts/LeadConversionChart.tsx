"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { CHART_AXIS_COLOR, CHART_GRID_COLOR, CHART_SURFACE_COLOR, LEAD_STAGE_ORDINAL_RAMP } from "@/lib/constants";
import { LEAD_STAGES } from "@/types";
import type { Lead } from "@/types";

export function LeadConversionChart({ leads }: { leads: Lead[] }) {
  const data = LEAD_STAGES.map((stage) => ({
    stage,
    count: leads.filter((lead) => lead.stage === stage).length,
  }));

  return (
    <Card className="p-6">
      <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Lead Conversion</p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="stage"
              width={90}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }}
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
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={16}>
              {data.map((entry, index) => (
                <Cell key={entry.stage} fill={LEAD_STAGE_ORDINAL_RAMP[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
