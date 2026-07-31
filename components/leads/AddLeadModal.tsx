"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { InsuranceType, Lead, Priority } from "@/types";

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

const emptyForm = {
  clientName: "",
  phone: "",
  email: "",
  insuranceType: INSURANCE_TYPES[0],
  producer: PRODUCERS[0],
  priority: "Medium" as Priority,
};

type AddLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (lead: Lead) => void;
};

export function AddLeadModal({ open, onClose, onAdd }: AddLeadModalProps) {
  const [formData, setFormData] = useState(emptyForm);

  // Cancel/backdrop/× all funnel through here, not just submit, so a
  // cancelled draft never survives into the next time this modal is opened.
  function handleClose() {
    setFormData(emptyForm);
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onAdd({
      id: Date.now(),
      clientName: formData.clientName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      insuranceType: formData.insuranceType as InsuranceType,
      producer: formData.producer,
      priority: formData.priority,
      stage: "New",
      lastContact: new Date().toISOString(),
    });

    setFormData(emptyForm);
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
            <select
              value={formData.producer}
              onChange={(event) => setFormData({ ...formData, producer: event.target.value })}
              className={FIELD_CLASSES}
            >
              {PRODUCERS.map((producer) => (
                <option key={producer}>{producer}</option>
              ))}
            </select>
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

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Save Lead</Button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-gray-300">{label}</label>
      {children}
    </div>
  );
}
