import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import type { Client, FamilyMember, InsuranceType } from "@/types";

export type NewClientInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  policyType: string;
  status: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  carrier?: string;
  policyNumber?: string;
  insuranceTypes?: InsuranceType[];
  /** Admin-only, `supabase` mode: explicitly assign to a different producer.
   * Omitted, the DB trigger defaults it to the caller (`auth.uid()`). */
  assignedProducerId?: string;
  /** `demo` mode only — the Supabase repository ignores this and derives
   * the display name via the `profiles` join at read time instead. */
  assignedProducerName?: string;
  /** `demo` mode only — `family_members` is a separate Supabase table, not
   * migrated this phase, so the Supabase repository ignores this entirely. */
  familyMembers?: FamilyMember[];
  isDemo?: boolean;
};

export type ClientsRepository = {
  list(): Promise<Result<Client[], DataBackendError>>;
  get(id: string): Promise<Result<Client | null, DataBackendError>>;
  create(input: NewClientInput): Promise<Result<Client, DataBackendError>>;
  update(id: string, patch: Partial<NewClientInput>): Promise<Result<Client, DataBackendError>>;
  archive(id: string): Promise<Result<Client, DataBackendError>>;
  restore(id: string): Promise<Result<Client, DataBackendError>>;
  createDemoBatch(inputs: NewClientInput[]): Promise<Result<Client[], DataBackendError>>;
  clearAgencyDemoClients(): Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

type ClientRow = Database["public"]["Tables"]["clients"]["Row"] & {
  assigned_producer: { full_name: string } | null;
};

// snake_case <-> camelCase, pure, unit-tested directly with no network.
export function mapRowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    policyType: (row.insurance_types?.[0] as InsuranceType | undefined) ?? "Auto",
    status: row.status,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zip: row.zip ?? undefined,
    carrier: row.carrier ?? undefined,
    policyNumber: row.policy_number ?? undefined,
    insuranceTypes: (row.insurance_types as InsuranceType[] | undefined) ?? [],
    createdAt: row.created_at,
    assignedProducerId: row.assigned_producer_id ?? undefined,
    assignedProducerName: row.assigned_producer?.full_name ?? undefined,
    agencyId: row.agency_id,
    archivedAt: row.archived_at ?? undefined,
    isDemo: row.is_demo,
  };
}

function mapInputToRow(input: NewClientInput): Database["public"]["Tables"]["clients"]["Insert"] {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    email: input.email,
    status: input.status as Database["public"]["Tables"]["clients"]["Row"]["status"],
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
    carrier: input.carrier,
    policy_number: input.policyNumber,
    insurance_types: input.insuranceTypes ?? (input.policyType ? [input.policyType] : []),
    assigned_producer_id: input.assignedProducerId,
    is_demo: input.isDemo ?? false,
  } as Database["public"]["Tables"]["clients"]["Insert"];
}

// Ambiguous otherwise: `clients` has three FKs to `profiles`
// (assigned_producer_id, created_by, updated_by), so a bare
// `profiles(full_name)` embed doesn't resolve to a single relationship.
// Named against the exact composite FK constraint from Phase 2's schema
// migration (clients_producer_same_agency).
const SELECT_WITH_PRODUCER = "*, assigned_producer:profiles!clients_producer_same_agency(full_name)";

function mapPostgrestError(error: PostgrestError): DataBackendError {
  // RLS denial / trigger-raised exceptions surface as a Postgres error with
  // no HTTP-style code PostgREST maps cleanly, or as 42501 (insufficient
  // privilege); connection-level failures never reach here as a
  // PostgrestError at all (see the catch-based "connection" mapping below).
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

// Factory taking an injected, already-constructed client — the same
// implementation serves the browser hook layer (anon key, RLS-scoped), the
// migration script (service-role key, Node-only), and repository
// integration tests (a signed-in test-user client for the behavior under
// test, a service-role client only for fixture setup/teardown).
export function createClientsRepository(supabase: SupabaseClient<Database>): ClientsRepository {
  async function list(): Promise<Result<Client[], DataBackendError>> {
    try {
      // Both active and archived clients — the UI does its own Active/
      // Archived filtering. Filtering server-side here would make the
      // Archived tab permanently empty.
      const { data, error } = await supabase
        .from("clients")
        .select(SELECT_WITH_PRODUCER)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as ClientRow[]).map(mapRowToClient) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function get(id: string): Promise<Result<Client | null, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select(SELECT_WITH_PRODUCER)
        .eq("id", id)
        .maybeSingle();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: data ? mapRowToClient(data as unknown as ClientRow) : null };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function create(input: NewClientInput): Promise<Result<Client, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert(mapInputToRow(input))
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToClient(data as unknown as ClientRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function update(
    id: string,
    patch: Partial<NewClientInput>
  ): Promise<Result<Client, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("clients")
        .update(mapInputToRow(patch as NewClientInput))
        .eq("id", id)
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToClient(data as unknown as ClientRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function archive(id: string): Promise<Result<Client, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("clients")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id)
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToClient(data as unknown as ClientRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function restore(id: string): Promise<Result<Client, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("clients")
        .update({ archived_at: null })
        .eq("id", id)
        .select(SELECT_WITH_PRODUCER)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToClient(data as unknown as ClientRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function createDemoBatch(inputs: NewClientInput[]): Promise<Result<Client[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert(inputs.map((input) => mapInputToRow({ ...input, isDemo: true })))
        .select(SELECT_WITH_PRODUCER);

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as ClientRow[]).map(mapRowToClient) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function clearAgencyDemoClients(): Promise<Result<{ deletedCount: number }, DataBackendError>> {
    try {
      const { data, error } = await supabase.rpc("clear_agency_demo_clients");
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: { deletedCount: (data as number) ?? 0 } };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  return { list, get, create, update, archive, restore, createDemoBatch, clearAgencyDemoClients };
}
