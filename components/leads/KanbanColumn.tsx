"use client";

import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import { LeadCard } from "@/components/leads/LeadCard";
import { LEAD_STAGE_STYLES } from "@/lib/constants";
import type { Lead, LeadStage } from "@/types";

export function KanbanColumn({ stage, leads }: { stage: LeadStage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition",
        isOver ? "border-yellow-400/60 bg-yellow-500/5" : "border-yellow-500/20 bg-black/40"
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className={clsx("rounded-full border px-3 py-1 text-xs font-bold", LEAD_STAGE_STYLES[stage])}>
          {stage}
        </span>
        <span className="text-xs font-bold text-gray-500">{leads.length}</span>
      </div>

      <div className="flex min-h-[120px] flex-1 flex-col gap-3 overflow-y-auto">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}
