"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { Client, InsuranceType } from "@/types";

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  policyType: "Auto",
  producer: PRODUCERS[0],
};

type AddClientModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (client: Client) => void;
};

export function AddClientModal({ open, onClose, onAdd }: AddClientModalProps) {
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
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      policyType: formData.policyType,
      status: "New Lead",
      insuranceTypes: [formData.policyType as InsuranceType],
      producer: formData.producer,
      createdAt: new Date().toISOString(),
    });

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

            <select
              value={formData.producer}
              onChange={(event) => setFormData({ ...formData, producer: event.target.value })}
              className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500"
            >
              {PRODUCERS.map((producer) => (
                <option key={producer}>{producer}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Save Client</Button>
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
