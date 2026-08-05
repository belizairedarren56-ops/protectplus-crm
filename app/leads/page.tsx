"use client";

import { useState } from "react";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { Button } from "@/components/ui/Button";
import { useLeads } from "@/hooks/useLeads";
import type { LeadStage } from "@/types";

export default function LeadsPage() {
  const { leads, leadsLoaded, isError, error, createLead, updateLead } = useLeads();
  const [showAddLead, setShowAddLead] = useState(false);
  const [stageChangeError, setStageChangeError] = useState<string | null>(null);

  async function handleStageChange(leadId: string, stage: LeadStage) {
    const current = leads.find((lead) => lead.id === leadId);
    if (!current || current.stage === stage) return; // no-op: dropped into its own column
    setStageChangeError(null);
    const result = await updateLead(leadId, { stage, lastContact: new Date().toISOString() });
    if (!result.ok) setStageChangeError(result.error.message);
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

      {stageChangeError && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {stageChangeError}
        </p>
      )}

      <div className="mt-8">
        {isError ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-16 text-center text-red-300">
            Could not load leads{error ? `: ${error.message}` : "."}
          </div>
        ) : !leadsLoaded ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 px-6 py-16 text-center text-gray-500">
            Loading leads...
          </div>
        ) : (
          <KanbanBoard leads={leads} onStageChange={handleStageChange} />
        )}
      </div>

      <AddLeadModal open={showAddLead} onClose={() => setShowAddLead(false)} onCreate={createLead} />
    </div>
  );
}
