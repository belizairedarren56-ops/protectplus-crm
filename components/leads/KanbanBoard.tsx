"use client";

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KanbanColumn } from "@/components/leads/KanbanColumn";
import { LEAD_STAGES } from "@/types";
import type { Lead, LeadStage } from "@/types";

type KanbanBoardProps = {
  leads: Lead[];
  onStageChange: (leadId: number, stage: LeadStage) => void;
};

export function KanbanBoard({ leads, onStageChange }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const stage = over.id as LeadStage;
    const leadId = Number(active.id);
    onStageChange(leadId, stage);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={leads.filter((lead) => lead.stage === stage)}
          />
        ))}
      </div>
    </DndContext>
  );
}
