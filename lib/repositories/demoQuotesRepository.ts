import type { DataBackendError } from "@/lib/dataMode";
import { activeLegacyKey, ensureLocalDataMigrated } from "@/lib/localDataMigrations";
import type { NewQuoteInput, QuotesRepository } from "@/lib/repositories/quotesRepository";
import type { Result } from "@/lib/result";
import { getItem, setItem } from "@/lib/storage";
import type { Quote } from "@/types";

// Same activeLegacyKey()-resolved read-transform-write shape as
// demoTasksRepository.ts — quotes was already one of the seven
// MIGRATED_KEYS entities; its id-format migration now also stringifies its
// own id and renames the legacy producer field to assignedProducerName
// (see lib/localDataMigrations.ts), so an existing browser's data carries
// over.

function toQuote(input: NewQuoteInput, id: string): Quote {
  return {
    id,
    clientId: input.clientId,
    clientName: input.clientName,
    carrier: input.carrier,
    premium: input.premium,
    coverage: input.coverage ?? "",
    assignedProducerName: input.assignedProducerName,
    insuranceType: input.insuranceType,
    status: input.status,
    createdAt: new Date().toISOString(),
    isDemo: input.isDemo ?? false,
  };
}

async function withMigratedKey<T>(
  fn: (key: string) => Result<T, DataBackendError>
): Promise<Result<T, DataBackendError>> {
  const migrated = await ensureLocalDataMigrated();
  if (!migrated.ok) return migrated;

  const keyResult = activeLegacyKey("quotes");
  if (!keyResult.ok) return keyResult;

  return fn(keyResult.data);
}

export const demoQuotesRepository: QuotesRepository = {
  async list() {
    return withMigratedKey((key) => ({ ok: true, data: getItem<Quote[]>(key, []) }));
  },

  async create(input) {
    return withMigratedKey((key) => {
      const quotes = getItem<Quote[]>(key, []);
      const quote = toQuote(input, String(Date.now()));
      setItem(key, [quote, ...quotes]);
      return { ok: true, data: quote };
    });
  },

  async update(id, patch) {
    return withMigratedKey((key) => {
      const quotes = getItem<Quote[]>(key, []);
      let updated: Quote | null = null;
      const next = quotes.map((quote) => {
        if (quote.id !== id) return quote;
        updated = { ...quote, ...patch };
        return updated;
      });
      if (!updated) {
        return { ok: false, error: { kind: "validation", message: `No demo quote with id ${id}` } };
      }
      setItem(key, next);
      return { ok: true, data: updated };
    });
  },

  async delete(id) {
    return withMigratedKey((key) => {
      const quotes = getItem<Quote[]>(key, []);
      setItem(
        key,
        quotes.filter((quote) => quote.id !== id)
      );
      return { ok: true, data: undefined };
    });
  },

  async createDemoBatch(inputs) {
    return withMigratedKey((key) => {
      const quotes = getItem<Quote[]>(key, []);
      const created = inputs.map((input, index) => toQuote({ ...input, isDemo: true }, `${Date.now()}-${index}`));
      setItem(key, [...created, ...quotes]);
      return { ok: true, data: created };
    });
  },

  async clearAgencyDemoQuotes() {
    return withMigratedKey((key) => {
      const quotes = getItem<Quote[]>(key, []);
      const remaining = quotes.filter((quote) => !quote.isDemo);
      const deletedCount = quotes.length - remaining.length;
      setItem(key, remaining);
      return { ok: true, data: { deletedCount } };
    });
  },
};
