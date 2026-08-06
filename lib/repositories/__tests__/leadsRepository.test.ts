import { describe, expect, it } from "vitest";
import { mapRowToLead } from "@/lib/repositories/leadsRepository";

// Pure, no network — proves the Row -> Lead mapping shape directly, since
// the real read/write round-trip is only otherwise exercised by
// tests/repositories/leadsRepository.test.ts against real local Supabase.

describe("mapRowToLead", () => {
  it("maps a full row, including the joined producer name", () => {
    const lead = mapRowToLead({
      id: "lead-1",
      agency_id: "agency-1",
      client_id: "client-1",
      client_name: "Jane Cooper",
      insurance_type: "Auto",
      stage: "New",
      priority: "Medium",
      last_contact: "2026-01-01T00:00:00.000Z",
      phone: "954-555-1234",
      email: "jane@example.com",
      producer_id: "producer-1",
      is_demo: false,
      legacy_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      created_by: null,
      updated_at: "2026-01-01T00:00:00.000Z",
      updated_by: null,
      assigned_producer: { full_name: "Maria Gonzalez" },
    });

    expect(lead).toEqual({
      id: "lead-1",
      clientId: "client-1",
      clientName: "Jane Cooper",
      insuranceType: "Auto",
      stage: "New",
      assignedProducerId: "producer-1",
      assignedProducerName: "Maria Gonzalez",
      priority: "Medium",
      lastContact: "2026-01-01T00:00:00.000Z",
      phone: "954-555-1234",
      email: "jane@example.com",
      isDemo: false,
    });
  });

  it("maps nullable columns to undefined, not null", () => {
    const lead = mapRowToLead({
      id: "lead-2",
      agency_id: "agency-1",
      client_id: null,
      client_name: "Unlinked Lead",
      insurance_type: "Home",
      stage: "New",
      priority: "Low",
      last_contact: null,
      phone: null,
      email: null,
      producer_id: "producer-1",
      is_demo: false,
      legacy_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      created_by: null,
      updated_at: "2026-01-01T00:00:00.000Z",
      updated_by: null,
      assigned_producer: null,
    });

    expect(lead.clientId).toBeUndefined();
    expect(lead.phone).toBeUndefined();
    expect(lead.email).toBeUndefined();
    expect(lead.assignedProducerName).toBeUndefined();
    // last_contact has no null-safe fallback in the Lead type (still
    // required, non-optional) — mapRowToLead falls back to "" rather than
    // propagating null.
    expect(lead.lastContact).toBe("");
  });
});
