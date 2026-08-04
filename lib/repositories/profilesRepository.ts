import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataBackendError } from "@/lib/dataMode";
import type { Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";

export type AgencyProducer = { id: string; fullName: string };

export type ProfilesRepository = {
  listAgencyProducers(): Promise<Result<AgencyProducer[], DataBackendError>>;
};

export function createProfilesRepository(supabase: SupabaseClient<Database>): ProfilesRepository {
  return {
    async listAgencyProducers() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name")
          .order("full_name", { ascending: true });

        if (error) {
          return { ok: false, error: { kind: "unknown", message: error.message, cause: error } };
        }
        return {
          ok: true,
          data: data.map((row) => ({ id: row.id, fullName: row.full_name })),
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            kind: "connection",
            message: error instanceof Error ? error.message : "Unable to reach Supabase.",
            cause: error,
          },
        };
      }
    },
  };
}

function notReady(): DataBackendError {
  return { kind: "not_ready", message: "Access scope is not ready yet." };
}

export const unavailableProfilesRepository: ProfilesRepository = {
  listAgencyProducers: () => Promise.resolve({ ok: false, error: notReady() }),
};
