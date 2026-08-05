"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useAccessScope } from "@/hooks/useAccessScope";
import { useAgencyProducers } from "@/hooks/useAgencyProducers";
import { useClients } from "@/hooks/useClients";
import type { DataBackendError } from "@/lib/dataMode";
import { CARRIERS, INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { NewQuoteInput } from "@/lib/repositories/quotesRepository";
import type { Result } from "@/lib/result";
import type { InsuranceType, Quote, QuoteStatus } from "@/types";

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

const QUOTE_STATUSES: QuoteStatus[] = ["Draft", "Sent", "Accepted", "Declined", "Expired"];

type QuoteModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewQuoteInput) => Promise<Result<Quote, DataBackendError>>;
  onUpdate: (id: string, patch: Partial<NewQuoteInput>) => Promise<Result<Quote, DataBackendError>>;
  quote?: Quote | null;
};

export function QuoteModal({ open, onClose, onCreate, onUpdate, quote }: QuoteModalProps) {
  const scope = useAccessScope();
  const isSupabase = scope.backend === "supabase";
  const isAdmin = scope.status === "ready" && isSupabase && scope.role === "admin";
  const currentUserId = scope.status === "ready" && isSupabase ? scope.userId : "";
  // Only fires for an admin in supabase mode — see useAgencyProducers().
  const producersQuery = useAgencyProducers();

  const { clients, isError: clientsErrored } = useClients();

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
        assignedProducerName: quote.assignedProducerName ?? PRODUCERS[0],
        assignedProducerId: quote.assignedProducerId ?? currentUserId,
        insuranceType: quote.insuranceType,
        status: quote.status,
      };
    }

    const firstClient = selectableClients[0];
    return {
      clientId: firstClient?.id ?? "",
      clientName: firstClient ? `${firstClient.firstName} ${firstClient.lastName}` : "",
      carrier: CARRIERS[0],
      premium: 0,
      coverage: "",
      assignedProducerName: PRODUCERS[0],
      assignedProducerId: currentUserId,
      insuranceType: INSURANCE_TYPES[0],
      status: "Draft" as QuoteStatus,
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `formData.clientId` is only set once, at mount, when this modal is
  // opened fresh — but this modal's own `useClients()` instance hasn't
  // necessarily loaded yet at that exact first render, so it can start at 0.
  // Deriving the effective id (rather than trusting the stored one) means
  // the form is always valid as soon as clients actually exist, with no
  // extra effect needed to "catch up" once the async load finishes.
  const effectiveClientId = formData.clientId || selectableClients[0]?.id || "";

  function handleClientChange(clientId: string) {
    const client = selectableClients.find((item) => item.id === clientId);
    setFormData({
      ...formData,
      clientId,
      clientName: client ? `${client.firstName} ${client.lastName}` : formData.clientName,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveClientId) return;

    const effectiveClient = selectableClients.find((item) => item.id === effectiveClientId);
    const effectiveClientName = effectiveClient
      ? `${effectiveClient.firstName} ${effectiveClient.lastName}`
      : formData.clientName;

    // producer_id is NOT NULL with no server-side default for an admin
    // caller (force_owner_quotes() only forces it for non-admins) — an
    // admin must always send a real id; a producer omits it entirely and
    // lets the trigger fill in auth.uid(), same as TaskModal's producer path.
    const assignee = isSupabase
      ? isAdmin
        ? { assignedProducerId: formData.assignedProducerId || currentUserId }
        : {}
      : { assignedProducerName: formData.assignedProducerName };

    const input: NewQuoteInput = {
      clientId: effectiveClientId,
      clientName: effectiveClientName,
      carrier: formData.carrier,
      premium: formData.premium,
      coverage: formData.coverage,
      insuranceType: formData.insuranceType,
      status: formData.status,
      ...assignee,
    };

    setSubmitting(true);
    setError(null);
    const result = quote ? await onUpdate(quote.id, input) : await onCreate(input);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    onClose();
  }

  // No clients to attach a quote to — quotes always require a real client
  // linkage now, so there's nothing valid to submit until one exists. A
  // clients-load failure degrades to the same empty state with a distinct
  // message, rather than crashing.
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
          title={clientsErrored ? "Clients unavailable" : "No clients yet"}
          description={
            clientsErrored
              ? "Could not load clients — check your connection and try again."
              : "Add a client first — every quote has to be linked to one."
          }
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
            value={effectiveClientId}
            onChange={(event) => handleClientChange(event.target.value)}
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

        {error && <p role="alert" className="text-sm font-semibold text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : quote ? "Save Changes" : "Create Quote"}
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
