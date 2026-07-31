"use client";

import { useState } from "react";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { Button } from "@/components/ui/Button";
import { useLeads } from "@/hooks/useLeads";
import type { LeadStage } from "@/types";

export default function LeadsPage() {
  const { leads, setLeads, leadsLoaded } = useLeads();
  const [showAddLead, setShowAddLead] = useState(false);

  function handleStageChange(leadId: number, stage: LeadStage) {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              stage,
              lastContact: lead.stage === stage ? lead.lastContact : new Date().toISOString(),
            }
          : lead
      )
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
            ProtectPlus CRM
          </p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Lead Pipeline</h1>
          <p className="mt-2 text-gray-400">
            Drag leads across stages as they move through the pipeline.
          </p>
        </div>

        <Button onClick={() => setShowAddLead(true)}>+ New Lead</Button>
      </div>

      <div className="mt-8">
        {!leadsLoaded ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 px-6 py-16 text-center text-gray-500">
            Loading leads...
          </div>
        ) : (
          <KanbanBoard leads={leads} onStageChange={handleStageChange} />
        )}
      </div>

      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        onAdd={(lead) => setLeads((current) => [lead, ...current])}
      />
    </div>
  );
}
