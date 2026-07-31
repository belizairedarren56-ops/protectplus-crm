"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CARRIERS, INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { InsuranceType, Quote, QuoteStatus } from "@/types";

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

const QUOTE_STATUSES: QuoteStatus[] = ["Draft", "Sent", "Accepted", "Declined", "Expired"];

function emptyForm(): Omit<Quote, "id" | "createdAt"> {
  return {
    clientName: "",
    carrier: CARRIERS[0],
    premium: 0,
    coverage: "",
    producer: PRODUCERS[0],
    insuranceType: INSURANCE_TYPES[0],
    status: "Draft",
  };
}

type QuoteModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (quote: Quote) => void;
  quote?: Quote | null;
};

export function QuoteModal({ open, onClose, onSave, quote }: QuoteModalProps) {
  const [formData, setFormData] = useState(() =>
    quote
      ? {
          clientName: quote.clientName,
          carrier: quote.carrier,
          premium: quote.premium,
          coverage: quote.coverage,
          producer: quote.producer,
          insuranceType: quote.insuranceType,
          status: quote.status,
        }
      : emptyForm()
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onSave({
      id: quote?.id ?? Date.now(),
      createdAt: quote?.createdAt ?? new Date().toISOString(),
      ...formData,
    });

    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quote ? "Edit Quote" : "Create Quote"}
      description="Track carrier quotes for a client."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Client Name">
          <input
            required
            value={formData.clientName}
            onChange={(event) => setFormData({ ...formData, clientName: event.target.value })}
            className={FIELD_CLASSES}
            placeholder="Jane Cooper"
          />
        </FormField>

        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Carrier">
            <select
              value={formData.carrier}
              onChange={(event) => setFormData({ ...formData, carrier: event.target.value })}
              className={FIELD_CLASSES}
            >
              {CARRIERS.map((carrier) => (
                <option key={carrier}>{carrier}</option>
              ))}
            </select>
          </FormField>

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
        </div>

        <FormField label="Coverage Summary">
          <input
            value={formData.coverage}
            onChange={(event) => setFormData({ ...formData, coverage: event.target.value })}
            className={FIELD_CLASSES}
            placeholder="$350k dwelling / $100k liability"
          />
        </FormField>

        <div className="grid gap-5 md:grid-cols-3">
          <FormField label="Premium ($/yr)">
            <input
              required
              type="number"
              min={0}
              value={formData.premium}
              onChange={(event) => setFormData({ ...formData, premium: Number(event.target.value) })}
              className={FIELD_CLASSES}
            />
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

          <FormField label="Status">
            <select
              value={formData.status}
              onChange={(event) =>
                setFormData({ ...formData, status: event.target.value as QuoteStatus })
              }
              className={FIELD_CLASSES}
            >
              {QUOTE_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{quote ? "Save Changes" : "Create Quote"}</Button>
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
