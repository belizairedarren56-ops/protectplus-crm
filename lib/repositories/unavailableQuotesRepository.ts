import type { DataBackendError } from "@/lib/dataMode";
import type { QuotesRepository } from "@/lib/repositories/quotesRepository";
import type { Result } from "@/lib/result";

function notReady(): DataBackendError {
  return { kind: "not_ready", message: "Access scope is not ready yet." };
}

function fail<T>(): Promise<Result<T, DataBackendError>> {
  return Promise.resolve({ ok: false, error: notReady() });
}

export const unavailableQuotesRepository: QuotesRepository = {
  list: () => fail(),
  create: () => fail(),
  update: () => fail(),
  delete: () => fail(),
  createDemoBatch: () => fail(),
  clearAgencyDemoQuotes: () => fail(),
};
