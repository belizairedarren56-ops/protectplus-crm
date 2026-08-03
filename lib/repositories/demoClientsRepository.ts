import type { DataBackendError } from "@/lib/dataMode";
import { activeLegacyKey, ensureLocalDataMigrated } from "@/lib/localDataMigrations";
import type { ClientsRepository, NewClientInput } from "@/lib/repositories/clientsRepository";
import type { Result } from "@/lib/result";
import { getItem, setItem } from "@/lib/storage";
import type { Client } from "@/types";

// Genuinely hook-free — no useState/useEffect/useLocalStorageList anywhere
// in this file. It's a plain object built directly on lib/storage.ts's
// existing get/set (themselves plain functions), safe to select from the
// non-hook getClientsRepository() function inside useClients(). TanStack
// Query's own cache is what makes the UI reactive after a mutation; this
// repository only needs to persist, not manage React state.
//
// Every method resolves the active (post-migration) key via
// activeLegacyKey("clients") rather than the raw STORAGE_KEYS.clients name —
// after a successful migration, the legacy key is a permanent, inert,
// read-only backup that is never read or written again.

function toClient(input: NewClientInput, id: string): Client {
  return {
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    policyType: input.policyType,
    status: input.status,
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
    carrier: input.carrier,
    policyNumber: input.policyNumber,
    insuranceTypes: input.insuranceTypes,
    createdAt: new Date().toISOString(),
    assignedProducerName: input.assignedProducerName,
    familyMembers: input.familyMembers,
    isDemo: input.isDemo ?? false,
  };
}

async function withMigratedKey<T>(
  fn: (key: string) => Result<T, DataBackendError>
): Promise<Result<T, DataBackendError>> {
  const migrated = await ensureLocalDataMigrated();
  if (!migrated.ok) return migrated;

  const keyResult = activeLegacyKey("clients");
  if (!keyResult.ok) return keyResult;

  return fn(keyResult.data);
}

export const demoClientsRepository: ClientsRepository = {
  async list() {
    // Both active and archived clients — the UI (ClientsPage) does its own
    // Active/Archived filtering, exactly like every other still-local
    // entity's archive/restore flow. Filtering here would make the
    // Archived tab permanently empty.
    return withMigratedKey((key) => ({ ok: true, data: getItem<Client[]>(key, []) }));
  },

  async get(id) {
    return withMigratedKey((key) => ({
      ok: true,
      data: getItem<Client[]>(key, []).find((client) => client.id === id) ?? null,
    }));
  },

  async create(input) {
    return withMigratedKey((key) => {
      const clients = getItem<Client[]>(key, []);
      const client = toClient(input, String(Date.now()));
      setItem(key, [client, ...clients]);
      return { ok: true, data: client };
    });
  },

  async update(id, patch) {
    return withMigratedKey((key) => {
      const clients = getItem<Client[]>(key, []);
      let updated: Client | null = null;
      const next = clients.map((client) => {
        if (client.id !== id) return client;
        updated = { ...client, ...patch, insuranceTypes: patch.insuranceTypes ?? client.insuranceTypes };
        return updated;
      });
      if (!updated) {
        return { ok: false, error: { kind: "validation", message: `No demo client with id ${id}` } };
      }
      setItem(key, next);
      return { ok: true, data: updated };
    });
  },

  async archive(id) {
    return withMigratedKey((key) => {
      const clients = getItem<Client[]>(key, []);
      let archived: Client | null = null;
      const next = clients.map((client) => {
        if (client.id !== id) return client;
        archived = { ...client, archivedAt: new Date().toISOString() };
        return archived;
      });
      if (!archived) {
        return { ok: false, error: { kind: "validation", message: `No demo client with id ${id}` } };
      }
      setItem(key, next);
      return { ok: true, data: archived };
    });
  },

  async restore(id) {
    return withMigratedKey((key) => {
      const clients = getItem<Client[]>(key, []);
      let restored: Client | null = null;
      const next = clients.map((client) => {
        if (client.id !== id) return client;
        restored = { ...client, archivedAt: undefined };
        return restored;
      });
      if (!restored) {
        return { ok: false, error: { kind: "validation", message: `No demo client with id ${id}` } };
      }
      setItem(key, next);
      return { ok: true, data: restored };
    });
  },

  async createDemoBatch(inputs) {
    return withMigratedKey((key) => {
      const clients = getItem<Client[]>(key, []);
      const created = inputs.map((input, index) => toClient({ ...input, isDemo: true }, `${Date.now()}-${index}`));
      setItem(key, [...created, ...clients]);
      return { ok: true, data: created };
    });
  },

  async clearAgencyDemoClients() {
    return withMigratedKey((key) => {
      const clients = getItem<Client[]>(key, []);
      const remaining = clients.filter((client) => !client.isDemo);
      const deletedCount = clients.length - remaining.length;
      setItem(key, remaining);
      return { ok: true, data: { deletedCount } };
    });
  },
};
