import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import type { InsuranceType, Lead, LeadStage, Priority } from "@/types";

export type NewLeadInput = {
  clientId?: string;
  clientName: string;
  insuranceType: InsuranceType;
  stage: LeadStage;
  priority: Priority;
  lastContact?: string;
  phone?: string;
  email?: string;
  /** Admin-only reassignment; omitted -> force_owner_leads() defaults to
   * auth.uid() for non-admins. */
  assignedProducerId?: string;
  /** `demo` mode only — the Supabase repository ignores this and derives
   * the display name via the `profiles` join at read time instead. */
  assignedProducerName?: string;
  isDemo?: boolean;
};

// No archive — leads has a real hard "Delete" action available at the RLS
// layer (admin-only, matching the existing leads_delete policy), but
// nothing in this phase's UI wires it up (no permanent-delete UI for
// leads — see the Phase 3C plan). delete() exists for interface
// consistency with every other entity, same precedent as documents' unused
// delete() in Phase 3B.
export type LeadsRepository = {
  list(): Promise<Result<Lead[], DataBackendError>>;
  create(input: NewLeadInput): Promise<Result<Lead, DataBackendError>>;
  update(id: string, patch: Partial<NewLeadInput>): Promise<Result<Lead, DataBackendError>>;
  delete(id: string): Promise<Result<void, DataBackendError>>;
  createDemoBatch(inputs: NewLeadInput[]): Promise<Result<Lead[], DataBackendError>>;
  clearAgencyDemoLeads(): Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

type LeadRow = Database["public"]["Tables"]["leads"]["Row"] & {
  assigned_producer: { full_name: string } | null;
};

export function mapRowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name,
    insuranceType: row.insurance_type as InsuranceType,
    stage: row.stage,
    assignedProducerId: row.producer_id,
    assignedProducerName: row.assigned_producer?.full_name ?? undefined,
    priority: row.priority,
    lastContact: row.last_contact ?? "",
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    isDemo: row.is_demo,
  };
}

function mapInputToRow(input: NewLeadInput, agencyId: string): Database["public"]["Tables"]["leads"]["Insert"] {
  return {
    agency_id: agencyId,
    client_id: input.clientId,
    client_name: input.clientName,
    insurance_type: input.insuranceType as Database["public"]["Tables"]["leads"]["Row"]["insurance_type"],
    stage: input.stage,
    priority: input.priority,
    last_contact: input.lastContact,
    phone: input.phone,
    email: input.email,
    producer_id: input.assignedProducerId,
    is_demo: input.isDemo ?? false,
  } as Database["public"]["Tables"]["leads"]["Insert"];
}

// Only fields explicitly present in the patch — same corrected pattern
// established in clientsRepository.ts's mapPatchToRow, applied from the
// start here.
function mapPatchToRow(patch: Partial<NewLeadInput>): Database["public"]["Tables"]["leads"]["Update"] {
  const row: Database["public"]["Tables"]["leads"]["Update"] = {};
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.clientName !== undefined) row.client_name = patch.clientName;
  if (patch.insuranceType !== undefined) {
    row.insurance_type = patch.insuranceType as Database["public"]["Tables"]["leads"]["Row"]["insurance_type"];
  }
  if (patch.stage !== undefined) row.stage = patch.stage;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.lastContact !== undefined) row.last_contact = patch.lastContact;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.assignedProducerId !== undefined) row.producer_id = patch.assignedProducerId;
  if (patch.isDemo !== undefined) row.is_demo = patch.isDemo;
  return row;
}

// leads has three FKs to profiles (producer_id, created_by, updated_by), so
// a bare profiles(full_name) embed is ambiguous — named against the exact
// composite FK constraint.
const SELECT_WITH_PRODUCER = "*, assigned_producer:profiles!leads_producer_id_agency_id_fkey(full_name)";

function mapPostgrestError(error: PostgrestError): DataBackendError {
  if (error.code === "42501" || /permission denied|only an admin/i.test(error.message)) {
    return { kind: "denied", message: error.message, cause: error };
  }
  if (error.code === "23505") {
    return { kind: "validation", message: error.message, cause: error };
  }
  return { kind: "unknown", message: error.message, cause: error };
}

function mapUnknownError(error: unknown): DataBackendError {
  return {
    kind: "connection",
    message: error instanceof Error ? error.message : "Unable to reach Supabase.",
    cause: error,
  };
}

export function createLeadsRepository(supabase: SupabaseClient<Database>, agencyId: string): LeadsRepository {
  async function list(): Promise<Result<Lead[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select(SELECT_WITH_PRODUCER)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as LeadRow[]).map(mapRowToLead) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function create(input: NewLeadInput): Promise<Result<Lead, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("leads")
        .insert(mapInputToRow(input, agencyId))
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToLead(data as unknown as LeadRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function update(id: string, patch: Partial<NewLeadInput>): Promise<Result<Lead, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("leads")
        .update(mapPatchToRow(patch))
        .eq("id", id)
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToLead(data as unknown as LeadRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function del(id: string): Promise<Result<void, DataBackendError>> {
    try {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function createDemoBatch(inputs: NewLeadInput[]): Promise<Result<Lead[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("leads")
        .insert(inputs.map((input) => mapInputToRow({ ...input, isDemo: true }, agencyId)))
        .select(SELECT_WITH_PRODUCER);

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as LeadRow[]).map(mapRowToLead) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function clearAgencyDemoLeads(): Promise<Result<{ deletedCount: number }, DataBackendError>> {
    try {
      const { data, error } = await supabase.rpc("clear_agency_demo_leads");
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: { deletedCount: (data as number) ?? 0 } };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  return { list, create, update, delete: del, createDemoBatch, clearAgencyDemoLeads };
}
