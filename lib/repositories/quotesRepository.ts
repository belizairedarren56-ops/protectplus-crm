import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import type { InsuranceType, Quote, QuoteStatus } from "@/types";

export type NewQuoteInput = {
  clientId: string;
  clientName: string;
  carrier: string;
  premium: number;
  coverage?: string;
  insuranceType: InsuranceType;
  status: QuoteStatus;
  /** Admin-only reassignment; omitted -> DB trigger defaults to auth.uid(). */
  assignedProducerId?: string;
  /** `demo` mode only — the Supabase repository ignores this and derives
   * the display name via the `profiles` join at read time instead. */
  assignedProducerName?: string;
  isDemo?: boolean;
};

// No archive — quotes has a real hard "Delete" action today, admin-only
// (matching the existing quotes_delete RLS policy).
export type QuotesRepository = {
  list(): Promise<Result<Quote[], DataBackendError>>;
  create(input: NewQuoteInput): Promise<Result<Quote, DataBackendError>>;
  update(id: string, patch: Partial<NewQuoteInput>): Promise<Result<Quote, DataBackendError>>;
  delete(id: string): Promise<Result<void, DataBackendError>>;
  createDemoBatch(inputs: NewQuoteInput[]): Promise<Result<Quote[], DataBackendError>>;
  clearAgencyDemoQuotes(): Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"] & {
  assigned_producer: { full_name: string } | null;
};

export function mapRowToQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    carrier: row.carrier,
    premium: Number(row.premium),
    coverage: row.coverage ?? "",
    assignedProducerId: row.producer_id,
    assignedProducerName: row.assigned_producer?.full_name ?? undefined,
    insuranceType: row.insurance_type as InsuranceType,
    status: row.status,
    createdAt: row.created_at,
    isDemo: row.is_demo,
  };
}

function mapInputToRow(input: NewQuoteInput, agencyId: string): Database["public"]["Tables"]["quotes"]["Insert"] {
  return {
    agency_id: agencyId,
    client_id: input.clientId,
    client_name: input.clientName,
    carrier: input.carrier,
    premium: input.premium,
    coverage: input.coverage,
    insurance_type: input.insuranceType as Database["public"]["Tables"]["quotes"]["Row"]["insurance_type"],
    status: input.status,
    producer_id: input.assignedProducerId,
    is_demo: input.isDemo ?? false,
  } as Database["public"]["Tables"]["quotes"]["Insert"];
}

// Only fields explicitly present in the patch — same corrected pattern
// established in clientsRepository.ts's mapPatchToRow.
function mapPatchToRow(patch: Partial<NewQuoteInput>): Database["public"]["Tables"]["quotes"]["Update"] {
  const row: Database["public"]["Tables"]["quotes"]["Update"] = {};
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.clientName !== undefined) row.client_name = patch.clientName;
  if (patch.carrier !== undefined) row.carrier = patch.carrier;
  if (patch.premium !== undefined) row.premium = patch.premium;
  if (patch.coverage !== undefined) row.coverage = patch.coverage;
  if (patch.insuranceType !== undefined) {
    row.insurance_type = patch.insuranceType as Database["public"]["Tables"]["quotes"]["Row"]["insurance_type"];
  }
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.assignedProducerId !== undefined) row.producer_id = patch.assignedProducerId;
  if (patch.isDemo !== undefined) row.is_demo = patch.isDemo;
  return row;
}

// quotes has two FKs to profiles (producer_id, created_by, updated_by —
// three, actually), so a bare profiles(full_name) embed is ambiguous —
// named against the exact composite FK constraint.
const SELECT_WITH_PRODUCER = "*, assigned_producer:profiles!quotes_producer_id_agency_id_fkey(full_name)";

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

export function createQuotesRepository(supabase: SupabaseClient<Database>, agencyId: string): QuotesRepository {
  async function list(): Promise<Result<Quote[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select(SELECT_WITH_PRODUCER)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as QuoteRow[]).map(mapRowToQuote) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function create(input: NewQuoteInput): Promise<Result<Quote, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .insert(mapInputToRow(input, agencyId))
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToQuote(data as unknown as QuoteRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function update(id: string, patch: Partial<NewQuoteInput>): Promise<Result<Quote, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .update(mapPatchToRow(patch))
        .eq("id", id)
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToQuote(data as unknown as QuoteRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function del(id: string): Promise<Result<void, DataBackendError>> {
    try {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function createDemoBatch(inputs: NewQuoteInput[]): Promise<Result<Quote[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .insert(inputs.map((input) => mapInputToRow({ ...input, isDemo: true }, agencyId)))
        .select(SELECT_WITH_PRODUCER);

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as QuoteRow[]).map(mapRowToQuote) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function clearAgencyDemoQuotes(): Promise<Result<{ deletedCount: number }, DataBackendError>> {
    try {
      const { data, error } = await supabase.rpc("clear_agency_demo_quotes");
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: { deletedCount: (data as number) ?? 0 } };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  return { list, create, update, delete: del, createDemoBatch, clearAgencyDemoQuotes };
}
