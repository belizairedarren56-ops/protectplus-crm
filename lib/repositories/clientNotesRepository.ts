import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";

// The "profile" note only — the single-editable-textarea behavior NotesTab
// has always had, now backed by a real row instead of raw localStorage
// text. Named explicitly (not a generic get/save) so a future timeline-
// notes repository method has an obviously distinct name to take instead
// of colliding with this one; see the client_notes migration for the full
// note_type design.
export type ClientNotesRepository = {
  getProfileNote(clientId: string): Promise<Result<string, DataBackendError>>;
  saveProfileNote(clientId: string, body: string): Promise<Result<string, DataBackendError>>;
};

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

// Factory taking an injected, already-constructed client — same three call
// sites as every other Supabase repository in this app (browser hook,
// repository integration tests; the importer writes client_notes directly
// through import_client_entities() instead, not through this repository).
export function createClientNotesRepository(supabase: SupabaseClient<Database>): ClientNotesRepository {
  async function getProfileNote(clientId: string): Promise<Result<string, DataBackendError>> {
    try {
      const { data, error } = await supabase
        .from("client_notes")
        .select("body")
        .eq("client_id", clientId)
        .eq("note_type", "profile")
        .maybeSingle();

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: data?.body ?? "" };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  // Ordinary .upsert() cannot target a partial unique index (no way to
  // pass the index's WHERE predicate as the conflict target) — the
  // upsert_client_profile_note() RPC is what actually performs the write;
  // this call is a thin wrapper, not a generic table operation.
  async function saveProfileNote(clientId: string, body: string): Promise<Result<string, DataBackendError>> {
    try {
      const { data, error } = await supabase.rpc("upsert_client_profile_note", {
        p_client_id: clientId,
        p_body: body,
      });

      if (error) return { ok: false, error: mapPostgrestError(error) };
      return { ok: true, data: (data as Database["public"]["Tables"]["client_notes"]["Row"]).body };
    } catch (error) {
      return { ok: false, error: mapUnknownError(error) };
    }
  }

  return { getProfileNote, saveProfileNote };
}
