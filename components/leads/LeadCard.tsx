"use client";

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PRIORITY_BADGE_STYLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Lead } from "@/types";

export function LeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none p-4 active:cursor-grabbing ${
        isDragging ? "z-10 opacity-40 shadow-2xl" : ""
      }`}
    >
      <p className="font-bold text-white">{lead.clientName}</p>
      <p className="mt-1 text-xs text-gray-500">{lead.insuranceType}</p>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">{lead.assignedProducerName ?? "Unassigned"}</span>
        <Badge className={PRIORITY_BADGE_STYLES[lead.priority]}>{lead.priority}</Badge>
      </div>

      <p className="mt-2 text-xs text-gray-600">Last contact: {formatDate(lead.lastContact)}</p>
    </Card>
  );
}
