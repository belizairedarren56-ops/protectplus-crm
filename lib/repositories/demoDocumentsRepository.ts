import type { DataBackendError } from "@/lib/dataMode";
import { activeLegacyKey, ensureLocalDataMigrated } from "@/lib/localDataMigrations";
import type { DocumentsRepository, NewDocumentInput } from "@/lib/repositories/documentsRepository";
import type { Result } from "@/lib/result";
import { getItem, setItem } from "@/lib/storage";
import type { Document } from "@/types";

// Same activeLegacyKey()-resolved read-transform-write shape as
// demoClientsRepository.ts — documents was already one of the seven
// MIGRATED_KEYS entities (its id-format migration now also stringifies its
// own id, not just clientId references — see lib/localDataMigrations.ts),
// so an existing browser's already-migrated document records carry over
// here rather than starting fresh under a new key.

function toDocument(input: NewDocumentInput, id: string): Document {
  return {
    id,
    name: input.name,
    folder: input.folder,
    clientId: input.clientId,
    clientName: input.clientName,
    uploadedAt: new Date().toISOString(),
    fileType: input.fileType,
    isDemo: input.isDemo ?? false,
  };
}

async function withMigratedKey<T>(
  fn: (key: string) => Result<T, DataBackendError>
): Promise<Result<T, DataBackendError>> {
  const migrated = await ensureLocalDataMigrated();
  if (!migrated.ok) return migrated;

  const keyResult = activeLegacyKey("documents");
  if (!keyResult.ok) return keyResult;

  return fn(keyResult.data);
}

export const demoDocumentsRepository: DocumentsRepository = {
  async list() {
    return withMigratedKey((key) => ({ ok: true, data: getItem<Document[]>(key, []) }));
  },

  async create(input) {
    return withMigratedKey((key) => {
      const documents = getItem<Document[]>(key, []);
      const document = toDocument(input, String(Date.now()));
      setItem(key, [document, ...documents]);
      return { ok: true, data: document };
    });
  },

  async update(id, patch) {
    return withMigratedKey((key) => {
      const documents = getItem<Document[]>(key, []);
      let updated: Document | null = null;
      const next = documents.map((document) => {
        if (document.id !== id) return document;
        updated = { ...document, ...patch };
        return updated;
      });
      if (!updated) {
        return { ok: false, error: { kind: "validation", message: `No demo document with id ${id}` } };
      }
      setItem(key, next);
      return { ok: true, data: updated };
    });
  },

  async delete(id) {
    return withMigratedKey((key) => {
      const documents = getItem<Document[]>(key, []);
      setItem(
        key,
        documents.filter((document) => document.id !== id)
      );
      return { ok: true, data: undefined };
    });
  },

  async createDemoBatch(inputs) {
    return withMigratedKey((key) => {
      const documents = getItem<Document[]>(key, []);
      const created = inputs.map((input, index) =>
        toDocument({ ...input, isDemo: true }, `${Date.now()}-${index}`)
      );
      setItem(key, [...created, ...documents]);
      return { ok: true, data: created };
    });
  },

  async clearAgencyDemoDocuments() {
    return withMigratedKey((key) => {
      const documents = getItem<Document[]>(key, []);
      const remaining = documents.filter((document) => !document.isDemo);
      const deletedCount = documents.length - remaining.length;
      setItem(key, remaining);
      return { ok: true, data: { deletedCount } };
    });
  },
};
