"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAccessScope } from "@/hooks/useAccessScope";
import { useAgencyProducers } from "@/hooks/useAgencyProducers";
import { INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { DataBackendError } from "@/lib/dataMode";
import type { NewLeadInput } from "@/lib/repositories/leadsRepository";
import type { Result } from "@/lib/result";
import type { InsuranceType, Lead, Priority } from "@/types";

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

type FormState = {
  clientName: string;
  phone: string;
  email: string;
  insuranceType: InsuranceType;
  priority: Priority;
  assignedProducerName: string; // demo mode only
  assignedProducerId: string; // supabase mode, admin only — "" means "assign to me" isn't resolved yet
};

function emptyForm(defaultAssignedProducerId: string): FormState {
  return {
    clientName: "",
    phone: "",
    email: "",
    insuranceType: INSURANCE_TYPES[0],
    priority: "Medium",
    assignedProducerName: PRODUCERS[0],
    assignedProducerId: defaultAssignedProducerId,
  };
}

type AddLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewLeadInput) => Promise<Result<Lead, DataBackendError>>;
};

// Create-only, matching today's exact behavior — no edit-lead UI exists;
// stage-change-via-drag remains the only update path. No client picker
// either — clientId stays nullable and unset by this modal, matching
// TaskModal's precedent (leads.client_id, like tasks.client_id, is
// nullable and the current UI has never set it).
export function AddLeadModal({ open, onClose, onCreate }: AddLeadModalProps) {
  const scope = useAccessScope();
  const isSupabase = scope.backend === "supabase";
  const isAdmin = scope.status === "ready" && isSupabase && scope.role === "admin";
  const currentUserId = scope.status === "ready" && isSupabase ? scope.userId : "";
  // Only fires for an admin in supabase mode — see useAgencyProducers().
  const producersQuery = useAgencyProducers();

  const [formData, setFormData] = useState<FormState>(() => emptyForm(currentUserId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cancel/backdrop/× all funnel through here, not just submit, so a
  // cancelled draft never survives into the next time this modal is opened.
  function handleClose() {
    setFormData(emptyForm(currentUserId));
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    // producer_id is NOT NULL with no server-side default for an admin
    // caller (force_owner_leads() only forces it for non-admins) — an
    // admin must always send a real id; a producer omits it entirely and
    // lets the trigger fill in auth.uid(), same as TaskModal's assignee path.
    const producer = isSupabase
      ? isAdmin
        ? { assignedProducerId: formData.assignedProducerId || currentUserId }
        : {}
      : { assignedProducerName: formData.assignedProducerName };

    const input: NewLeadInput = {
      clientName: formData.clientName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      insuranceType: formData.insuranceType,
      priority: formData.priority,
      stage: "New",
      lastContact: new Date().toISOString(),
      ...producer,
    };

    const result = await onCreate(input);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setFormData(emptyForm(currentUserId));
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add New Lead"
      description="Capture a new prospect into the pipeline."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Client Name">
          <input
            required
            value={formData.clientName}
            onChange={(event) => setFormData({ ...formData, clientName: event.target.value })}
            placeholder="Jane Cooper"
            className={FIELD_CLASSES}
          />
        </FormField>

        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Phone">
            <input
              value={formData.phone}
              onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
              placeholder="954-555-1234"
              className={FIELD_CLASSES}
            />
          </FormField>

          <FormField label="Email">
            <input
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              placeholder="jane@email.com"
              className={FIELD_CLASSES}
            />
          </FormField>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <FormField label="Insurance Type">
            <select
              value={formData.insuranceType}
              onChange={(event) =>
                setFormData({ ...formData, insuranceType: event.target.value as InsuranceType })
              }
              className={FIELD_CLASSES}
            >
              {INSURANCE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Producer">
            {!isSupabase ? (
              <select
                value={formData.assignedProducerName}
                onChange={(event) => setFormData({ ...formData, assignedProducerName: event.target.value })}
                className={FIELD_CLASSES}
              >
                {PRODUCERS.map((producer) => (
                  <option key={producer}>{producer}</option>
                ))}
              </select>
            ) : isAdmin ? (
              <select
                value={formData.assignedProducerId}
                onChange={(event) => setFormData({ ...formData, assignedProducerId: event.target.value })}
                disabled={producersQuery.isLoading}
                className={`${FIELD_CLASSES} disabled:opacity-50`}
              >
                {(producersQuery.data ?? []).map((producer) => (
                  <option key={producer.id} value={producer.id}>
                    {producer.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <p className="w-full rounded-xl border border-gray-800 bg-black/50 px-4 py-3 text-gray-400">
                Assigned to you
              </p>
            )}
          </FormField>

          <FormField label="Priority">
            <select
              value={formData.priority}
              onChange={(event) =>
                setFormData({ ...formData, priority: event.target.value as Priority })
              }
              className={FIELD_CLASSES}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </FormField>
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold text-gray-300">{label}</span>
      {children}
    </label>
  );
}
