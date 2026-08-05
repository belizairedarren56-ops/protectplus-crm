import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import type { InsuranceType, Policy, PolicyStatus } from "@/types";

export type NewPolicyInput = {
  clientId: string;
  clientName: string;
  carrier: string;
  policyNumber: string;
  product: InsuranceType;
  effectiveDate: string;
  expirationDate: string;
  status: PolicyStatus;
  premium: number;
  /** Admin-only reassignment; omitted -> DB trigger defaults to auth.uid(). */
  assignedProducerId?: string;
  /** `demo` mode only — the Supabase repository ignores this and derives
   * the display name via the `profiles` join at read time instead. */
  assignedProducerName?: string;
  isDemo?: boolean;
};

// No archive — policies has a real hard "Delete" action today, admin-only
// (matching the existing policies_delete RLS policy).
export type PoliciesRepository = {
  list(): Promise<Result<Policy[], DataBackendError>>;
  create(input: NewPolicyInput): Promise<Result<Policy, DataBackendError>>;
  update(id: string, patch: Partial<NewPolicyInput>): Promise<Result<Policy, DataBackendError>>;
  delete(id: string): Promise<Result<void, DataBackendError>>;
  createDemoBatch(inputs: NewPolicyInput[]): Promise<Result<Policy[], DataBackendError>>;
  clearAgencyDemoPolicies(): Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

type PolicyRow = Database["public"]["Tables"]["policies"]["Row"] & {
  assigned_producer: { full_name: string } | null;
};

export function mapRowToPolicy(row: PolicyRow): Policy {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    carrier: row.carrier,
    policyNumber: row.policy_number,
    product: row.product as InsuranceType,
    effectiveDate: row.effective_date,
    expirationDate: row.expiration_date,
    status: row.status,
    premium: Number(row.premium),
    assignedProducerId: row.producer_id,
    assignedProducerName: row.assigned_producer?.full_name ?? undefined,
    isDemo: row.is_demo,
  };
}

function mapInputToRow(
  input: NewPolicyInput,
  agencyId: string
): Database["public"]["Tables"]["policies"]["Insert"] {
  return {
    agency_id: agencyId,
    client_id: input.clientId,
    client_name: input.clientName,
    carrier: input.carrier,
    policy_number: input.policyNumber,
    product: input.product as Database["public"]["Tables"]["policies"]["Row"]["product"],
    effective_date: input.effectiveDate,
    expiration_date: input.expirationDate,
    status: input.status,
    premium: input.premium,
    producer_id: input.assignedProducerId,
    is_demo: input.isDemo ?? false,
  } as Database["public"]["Tables"]["policies"]["Insert"];
}

// Only fields explicitly present in the patch — same corrected pattern
// established in clientsRepository.ts's mapPatchToRow.
function mapPatchToRow(patch: Partial<NewPolicyInput>): Database["public"]["Tables"]["policies"]["Update"] {
  const row: Database["public"]["Tables"]["policies"]["Update"] = {};
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.clientName !== undefined) row.client_name = patch.clientName;
  if (patch.carrier !== undefined) row.carrier = patch.carrier;
  if (patch.policyNumber !== undefined) row.policy_number = patch.policyNumber;
  if (patch.product !== undefined) {
    row.product = patch.product as Database["public"]["Tables"]["policies"]["Row"]["product"];
  }
  if (patch.effectiveDate !== undefined) row.effective_date = patch.effectiveDate;
  if (patch.expirationDate !== undefined) row.expiration_date = patch.expirationDate;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.premium !== undefined) row.premium = patch.premium;
  if (patch.assignedProducerId !== undefined) row.producer_id = patch.assignedProducerId;
  if (patch.isDemo !== undefined) row.is_demo = patch.isDemo;
  return row;
}

// policies has three FKs to profiles (producer_id, created_by, updated_by),
// so a bare profiles(full_name) embed is ambiguous — named against the
// exact composite FK constraint.
const SELECT_WITH_PRODUCER = "*, assigned_producer:profiles!policies_producer_id_agency_id_fkey(full_name)";

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

export function createPoliciesRepository(supabase: SupabaseClient<Database>, agencyId: string): PoliciesRepository {
  async function list(): Promise<Result<Policy[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("policies")
        .select(SELECT_WITH_PRODUCER)
        .order("effective_date", { ascending: false });

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as PolicyRow[]).map(mapRowToPolicy) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function create(input: NewPolicyInput): Promise<Result<Policy, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("policies")
        .insert(mapInputToRow(input, agencyId))
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToPolicy(data as unknown as PolicyRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function update(id: string, patch: Partial<NewPolicyInput>): Promise<Result<Policy, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("policies")
        .update(mapPatchToRow(patch))
        .eq("id", id)
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToPolicy(data as unknown as PolicyRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function del(id: string): Promise<Result<void, DataBackendError>> {
    try {
      const { error } = await supabase.from("policies").delete().eq("id", id);
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function createDemoBatch(inputs: NewPolicyInput[]): Promise<Result<Policy[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("policies")
        .insert(inputs.map((input) => mapInputToRow({ ...input, isDemo: true }, agencyId)))
        .select(SELECT_WITH_PRODUCER);

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as PolicyRow[]).map(mapRowToPolicy) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function clearAgencyDemoPolicies(): Promise<Result<{ deletedCount: number }, DataBackendError>> {
    try {
      const { data, error } = await supabase.rpc("clear_agency_demo_policies");
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: { deletedCount: (data as number) ?? 0 } };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  return { list, create, update, delete: del, createDemoBatch, clearAgencyDemoPolicies };
}
