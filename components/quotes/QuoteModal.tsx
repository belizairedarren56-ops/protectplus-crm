"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useClients } from "@/hooks/useClients";
import { CARRIERS, INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { InsuranceType, Quote, QuoteStatus } from "@/types";

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

const QUOTE_STATUSES: QuoteStatus[] = ["Draft", "Sent", "Accepted", "Declined", "Expired"];

type QuoteModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (quote: Quote) => void;
  quote?: Quote | null;
};

export function QuoteModal({ open, onClose, onSave, quote }: QuoteModalProps) {
  const { clients } = useClients();

  // Archived clients can't be picked for a *new* quote, but an existing quote
  // tied to a since-archived client still shows correctly when editing.
  const selectableClients = useMemo(() => {
    const pool = quote
      ? clients.filter((client) => !client.archivedAt || client.id === quote.clientId)
      : clients.filter((client) => !client.archivedAt);

    return [...pool].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
  }, [clients, quote]);

  const [formData, setFormData] = useState(() => {
    if (quote) {
      return {
        clientId: quote.clientId,
        clientName: quote.clientName,
        carrier: quote.carrier,
        premium: quote.premium,
        coverage: quote.coverage,
        producer: quote.producer,
        insuranceType: quote.insuranceType,
        status: quote.status,
      };
    }

    const firstClient = selectableClients[0];
    return {
      clientId: firstClient?.id ?? 0,
      clientName: firstClient ? `${firstClient.firstName} ${firstClient.lastName}` : "",
      carrier: CARRIERS[0],
      premium: 0,
      coverage: "",
      producer: PRODUCERS[0],
      insuranceType: INSURANCE_TYPES[0],
      status: "Draft" as QuoteStatus,
    };
  });

  function handleClientChange(clientId: number) {
    const client = selectableClients.find((item) => item.id === clientId);
    setFormData({
      ...formData,
      clientId,
      clientName: client ? `${client.firstName} ${client.lastName}` : formData.clientName,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formData.clientId) return;

    onSave({
      id: quote?.id ?? Date.now(),
      createdAt: quote?.createdAt ?? new Date().toISOString(),
      ...formData,
    });

    onClose();
  }

  // No clients to attach a quote to — quotes always require a real client
  // linkage now, so there's nothing valid to submit until one exists.
  if (selectableClients.length === 0) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Create Quote"
        description="Track carrier quotes for a client."
      >
        <EmptyState
          icon="👤"
          title="No clients yet"
          description="Add a client first — every quote has to be linked to one."
        />
        <div className="flex justify-end pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quote ? "Edit Quote" : "Create Quote"}
      description="Track carrier quotes for a client."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Client">
          <select
            required
            value={formData.clientId}
            onChange={(event) => handleClientChange(Number(event.target.value))}
            className={FIELD_CLASSES}
          >
            {selectableClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.firstName} {client.lastName}
                {client.archivedAt ? " (archived)" : ""}
              </option>
            ))}
          </select>
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
