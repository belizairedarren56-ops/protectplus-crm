"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAccessScope } from "@/hooks/useAccessScope";
import { useAgencyProducers } from "@/hooks/useAgencyProducers";
import type { DataBackendError } from "@/lib/dataMode";
import type { NewClientInput } from "@/lib/repositories/clientsRepository";
import type { Result } from "@/lib/result";
import { INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { Client, InsuranceType } from "@/types";

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  policyType: "Auto",
  producerName: PRODUCERS[0], // demo mode only
  assignedProducerId: "", // supabase mode, admin only
};

type AddClientModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (input: NewClientInput) => Promise<Result<Client, DataBackendError>>;
};

export function AddClientModal({ open, onClose, onAdd }: AddClientModalProps) {
  const scope = useAccessScope();
  const isSupabase = scope.backend === "supabase";
  const isAdmin = scope.status === "ready" && isSupabase && scope.role === "admin";
  // Only fires for an admin in supabase mode — see useAgencyProducers().
  const producersQuery = useAgencyProducers();

  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cancel/backdrop/× all funnel through here, not just submit, so a
  // cancelled draft never survives into the next time this modal is opened.
  function handleClose() {
    setFormData(emptyForm);
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: NewClientInput = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      policyType: formData.policyType,
      status: "New Lead",
      insuranceTypes: [formData.policyType as InsuranceType],
      ...(isSupabase
        ? isAdmin && formData.assignedProducerId
          ? { assignedProducerId: formData.assignedProducerId }
          : {}
        : { assignedProducerName: formData.producerName }),
    };

    const result = await onAdd(input);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setFormData(emptyForm);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add New Client"
      description="Enter the client's contact and insurance information."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <FormInput
            label="First Name"
            placeholder="John"
            value={formData.firstName}
            onChange={(value) => setFormData({ ...formData, firstName: value })}
          />

          <FormInput
            label="Last Name"
            placeholder="Smith"
            value={formData.lastName}
            onChange={(value) => setFormData({ ...formData, lastName: value })}
          />
        </div>

        <FormInput
          label="Phone"
          placeholder="954-555-1234"
          type="tel"
          value={formData.phone}
          onChange={(value) => setFormData({ ...formData, phone: value })}
        />

        <FormInput
          label="Email"
          placeholder="client@email.com"
          type="email"
          value={formData.email}
          onChange={(value) => setFormData({ ...formData, email: value })}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block font-semibold text-gray-300">Insurance Type</span>

            <select
              value={formData.policyType}
              onChange={(event) => setFormData({ ...formData, policyType: event.target.value })}
              className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500"
            >
              {INSURANCE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block font-semibold text-gray-300">Producer</span>

            {!isSupabase ? (
              <select
                value={formData.producerName}
                onChange={(event) => setFormData({ ...formData, producerName: event.target.value })}
                className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500"
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
                className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500 disabled:opacity-50"
              >
                <option value="">Assign to me</option>
                {(producersQuery.data ?? []).map((producer) => (
                  <option key={producer.id} value={producer.id}>
                    {producer.fullName}
                  </option>
                ))}
              </select>
            ) : (
              // A producer has no valid alternative — a picker here would
              // just be rejected server-side, so show read-only text instead
              // of a confusing single-option dropdown.
              <p className="w-full rounded-xl border border-gray-800 bg-black/50 px-4 py-3 text-gray-400">
                Assigned to you
              </p>
            )}
          </label>
        </div>

        {error && <p className="text-sm font-semibold text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Client"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type FormInputProps = {
  label: string;
  placeholder: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
};

function FormInput({ label, placeholder, value, type = "text", onChange }: FormInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold text-gray-300">{label}</span>

      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white placeholder:text-gray-600 outline-none focus:border-yellow-500"
      />
    </label>
  );
}
