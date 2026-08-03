import type { DataBackendError } from "@/lib/dataMode";
import type { ClientsRepository } from "@/lib/repositories/clientsRepository";
import type { Result } from "@/lib/result";

function notReady(): DataBackendError {
  return { kind: "not_ready", message: "Access scope is not ready yet." };
}

function fail<T>(): Promise<Result<T, DataBackendError>> {
  return Promise.resolve({ ok: false, error: notReady() });
}

// Selected whenever the access scope isn't "ready" (loading/unauthenticated/
// error) — every method refuses to attempt any read or write, returning a
// typed not-ready error immediately. Because both queries and mutations in
// useClients()/useAgencyProducers() route through the same repository
// selector, this uniformly blocks writes during loading too, not just reads.
export const unavailableClientsRepository: ClientsRepository = {
  list: () => fail(),
  get: () => fail(),
  create: () => fail(),
  update: () => fail(),
  archive: () => fail(),
  restore: () => fail(),
  createDemoBatch: () => fail(),
  clearAgencyDemoClients: () => fail(),
};
