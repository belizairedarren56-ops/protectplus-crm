import type { DataBackendError } from "@/lib/dataMode";
import type { ClientNotesRepository } from "@/lib/repositories/clientNotesRepository";
import type { Result } from "@/lib/result";

function notReady(): DataBackendError {
  return { kind: "not_ready", message: "Access scope is not ready yet." };
}

function fail<T>(): Promise<Result<T, DataBackendError>> {
  return Promise.resolve({ ok: false, error: notReady() });
}

export const unavailableClientNotesRepository: ClientNotesRepository = {
  getProfileNote: () => fail(),
  saveProfileNote: () => fail(),
};
