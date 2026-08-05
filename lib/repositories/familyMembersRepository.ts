import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import type { FamilyMember } from "@/types";

export type NewFamilyMemberInput = {
  clientId: string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
};

// No archive/is_demo/clear concept — family_members has no owner column and
// no demo tagging of its own; it cascade-deletes with its parent client
// (on delete cascade, since Phase 2), so clearing a demo client already
// takes its family members with it.
export type FamilyMembersRepository = {
  list(): Promise<Result<FamilyMember[], DataBackendError>>;
  create(input: NewFamilyMemberInput): Promise<Result<FamilyMember, DataBackendError>>;
  update(id: string, patch: Partial<NewFamilyMemberInput>): Promise<Result<FamilyMember, DataBackendError>>;
  delete(id: string): Promise<Result<void, DataBackendError>>;
};

type FamilyMemberRow = Database["public"]["Tables"]["family_members"]["Row"];

export function mapRowToFamilyMember(row: FamilyMemberRow): FamilyMember {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    relationship: row.relationship,
    dateOfBirth: row.date_of_birth ?? undefined,
  };
}

function mapInputToRow(
  input: NewFamilyMemberInput,
  agencyId: string
): Database["public"]["Tables"]["family_members"]["Insert"] {
  return {
    agency_id: agencyId,
    client_id: input.clientId,
    name: input.name,
    relationship: input.relationship,
    date_of_birth: input.dateOfBirth,
  };
}

function mapPatchToRow(
  patch: Partial<NewFamilyMemberInput>
): Database["public"]["Tables"]["family_members"]["Update"] {
  const row: Database["public"]["Tables"]["family_members"]["Update"] = {};
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.relationship !== undefined) row.relationship = patch.relationship;
  if (patch.dateOfBirth !== undefined) row.date_of_birth = patch.dateOfBirth;
  return row;
}

function mapPostgrestError(error: PostgrestError): DataBackendError {
  if (error.code === "42501" || /permission denied|not authorized/i.test(error.message)) {
    return { kind: "denied", message: error.message, cause: error };
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

export function createFamilyMembersRepository(
  supabase: SupabaseClient<Database>,
  agencyId: string
): FamilyMembersRepository {
  async function list(): Promise<Result<FamilyMember[], DataBackendError>> {
    try {
      // Full-list-fetch, same as every other still-local entity — the UI
      // filters by clientId client-side (see app/clients/[id]/page.tsx).
      const { data, error } = await supabase.from("family_members").select("*").order("name", { ascending: true });

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as FamilyMemberRow[]).map(mapRowToFamilyMember) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function create(input: NewFamilyMemberInput): Promise<Result<FamilyMember, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("family_members")
        .insert(mapInputToRow(input, agencyId))
        .select("*")
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToFamilyMember(data as FamilyMemberRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function update(
    id: string,
    patch: Partial<NewFamilyMemberInput>
  ): Promise<Result<FamilyMember, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("family_members")
        .update(mapPatchToRow(patch))
        .eq("id", id)
        .select("*")
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToFamilyMember(data as FamilyMemberRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function del(id: string): Promise<Result<void, DataBackendError>> {
    try {
      const { error } = await supabase.from("family_members").delete().eq("id", id);
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  return { list, create, update, delete: del };
}
