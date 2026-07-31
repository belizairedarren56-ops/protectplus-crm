"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useClients } from "@/hooks/useClients";
import { CARRIERS, INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { InsuranceType, Policy, PolicyStatus } from "@/types";

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

const POLICY_STATUSES: PolicyStatus[] = ["Active", "Renewal Due", "Cancelled", "Expired"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type PolicyModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (policy: Policy) => void;
  policy?: Policy | null;
};

export function PolicyModal({ open, onClose, onSave, policy }: PolicyModalProps) {
  const { clients } = useClients();

  const selectableClients = useMemo(() => {
    const pool = policy
      ? clients.filter((client) => !client.archivedAt || client.id === policy.clientId)
      : clients.filter((client) => !client.archivedAt);

    return [...pool].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
  }, [clients, policy]);

  const [formData, setFormData] = useState(() => {
    if (policy) {
      return {
        clientId: policy.clientId,
        clientName: policy.clientName,
        carrier: policy.carrier,
        policyNumber: policy.policyNumber,
        product: policy.product,
        effectiveDate: policy.effectiveDate.slice(0, 10),
        expirationDate: policy.expirationDate.slice(0, 10),
        status: policy.status,
        premium: policy.premium,
        producer: policy.producer,
      };
    }

    const firstClient = selectableClients[0];
    return {
      clientId: firstClient?.id ?? 0,
      clientName: firstClient ? `${firstClient.firstName} ${firstClient.lastName}` : "",
      carrier: CARRIERS[0],
      policyNumber: "",
      product: INSURANCE_TYPES[0],
      effectiveDate: todayIso(),
      expirationDate: todayIso(),
      status: "Active" as PolicyStatus,
      premium: 0,
      producer: PRODUCERS[0],
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
      id: policy?.id ?? Date.now(),
      ...formData,
    });

    onClose();
  }

  // Policies always require a real client linkage now — nothing valid to
  // submit until at least one client exists.
  if (selectableClients.length === 0) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Add Policy"
        description="Track an active or upcoming client policy."
      >
        <EmptyState
          icon="👤"
          title="No clients yet"
          description="Add a client first — every policy has to be linked to one."
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
      title={policy ? "Edit Policy" : "Add Policy"}
      description="Track an active or upcoming client policy."
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
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

          <FormField label="Policy Number">
            <input
              required
              value={formData.policyNumber}
              onChange={(event) => setFormData({ ...formData, policyNumber: event.target.value })}
              className={FIELD_CLASSES}
              placeholder="SF-1234567"
            />
          </FormField>
        </div>

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

          <FormField label="Product">
            <select
              value={formData.product}
              onChange={(event) =>
                setFormData({ ...formData, product: event.target.value as InsuranceType })
              }
              className={FIELD_CLASSES}
            >
              {INSURANCE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Effective Date">
            <input
              required
              type="date"
              value={formData.effectiveDate}
              onChange={(event) => setFormData({ ...formData, effectiveDate: event.target.value })}
              className={FIELD_CLASSES}
            />
          </FormField>

          <FormField label="Expiration Date">
            <input
              required
              type="date"
              value={formData.expirationDate}
              onChange={(event) => setFormData({ ...formData, expirationDate: event.target.value })}
              className={FIELD_CLASSES}
            />
          </FormField>
        </div>

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
                setFormData({ ...formData, status: event.target.value as PolicyStatus })
              }
              className={FIELD_CLASSES}
            >
              {POLICY_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{policy ? "Save Changes" : "Add Policy"}</Button>
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
