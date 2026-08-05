import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import type { Document, DocumentFolder } from "@/types";

// Metadata only — no real uploads this phase. storage_path stays reserved,
// unused, exactly as it is in the schema today.
export type NewDocumentInput = {
  name: string;
  folder: DocumentFolder;
  clientId?: string;
  fileType: string;
  /** `demo` mode only — the Supabase repository ignores this and derives
   * the display name via the `clients` join at read time instead. */
  clientName?: string;
  isDemo?: boolean;
};

export type DocumentsRepository = {
  list(): Promise<Result<Document[], DataBackendError>>;
  create(input: NewDocumentInput): Promise<Result<Document, DataBackendError>>;
  update(id: string, patch: Partial<NewDocumentInput>): Promise<Result<Document, DataBackendError>>;
  delete(id: string): Promise<Result<void, DataBackendError>>;
  createDemoBatch(inputs: NewDocumentInput[]): Promise<Result<Document[], DataBackendError>>;
  clearAgencyDemoDocuments(): Promise<Result<{ deletedCount: number }, DataBackendError>>;
};

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"] & {
  client: { first_name: string; last_name: string } | null;
};

export function mapRowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    name: row.name,
    folder: row.folder as DocumentFolder,
    clientId: row.client_id ?? undefined,
    clientName: row.client ? `${row.client.first_name} ${row.client.last_name}` : undefined,
    uploadedAt: row.created_at,
    fileType: row.file_type ?? "",
    agencyId: row.agency_id,
    isDemo: row.is_demo,
  };
}

function mapInputToRow(
  input: NewDocumentInput,
  agencyId: string
): Database["public"]["Tables"]["documents"]["Insert"] {
  return {
    agency_id: agencyId,
    name: input.name,
    folder: input.folder as Database["public"]["Tables"]["documents"]["Row"]["folder"],
    client_id: input.clientId,
    file_type: input.fileType,
    is_demo: input.isDemo ?? false,
  };
}

// Only fields explicitly present in the patch — same corrected pattern as
// clientsRepository.ts's mapPatchToRow, applied from the start here.
function mapPatchToRow(patch: Partial<NewDocumentInput>): Database["public"]["Tables"]["documents"]["Update"] {
  const row: Database["public"]["Tables"]["documents"]["Update"] = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.folder !== undefined) {
    row.folder = patch.folder as Database["public"]["Tables"]["documents"]["Row"]["folder"];
  }
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.fileType !== undefined) row.file_type = patch.fileType;
  if (patch.isDemo !== undefined) row.is_demo = patch.isDemo;
  return row;
}

// documents has exactly one FK to clients (client_id), so this embed hint
// isn't strictly required to disambiguate — named explicitly anyway to
// match the precise-embed convention every other repository in this app
// follows.
const SELECT_WITH_CLIENT = "*, client:clients!documents_client_id_agency_id_fkey(first_name, last_name)";

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

export function createDocumentsRepository(
  supabase: SupabaseClient<Database>,
  agencyId: string
): DocumentsRepository {
  async function list(): Promise<Result<Document[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select(SELECT_WITH_CLIENT)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as DocumentRow[]).map(mapRowToDocument) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function create(input: NewDocumentInput): Promise<Result<Document, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("documents")
        .insert(mapInputToRow(input, agencyId))
        .select(SELECT_WITH_CLIENT)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToDocument(data as unknown as DocumentRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function update(
    id: string,
    patch: Partial<NewDocumentInput>
  ): Promise<Result<Document, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("documents")
        .update(mapPatchToRow(patch))
        .eq("id", id)
        .select(SELECT_WITH_CLIENT)
        .single();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: mapRowToDocument(data as unknown as DocumentRow) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function del(id: string): Promise<Result<void, DataBackendError>> {
    try {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function createDemoBatch(inputs: NewDocumentInput[]): Promise<Result<Document[], DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("documents")
        .insert(inputs.map((input) => mapInputToRow({ ...input, isDemo: true }, agencyId)))
        .select(SELECT_WITH_CLIENT);

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as unknown as DocumentRow[]).map(mapRowToDocument) };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  async function clearAgencyDemoDocuments(): Promise<Result<{ deletedCount: number }, DataBackendError>> {
    try {
      const { data, error } = await supabase.rpc("clear_agency_demo_documents");
      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: { deletedCount: (data as number) ?? 0 } };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  return { list, create, update, delete: del, createDemoBatch, clearAgencyDemoDocuments };
}
