import type { DataBackendError } from "@/lib/dataMode";
import { activeLegacyKey, ensureLocalDataMigrated } from "@/lib/localDataMigrations";
import type { LeadsRepository, NewLeadInput } from "@/lib/repositories/leadsRepository";
import type { Result } from "@/lib/result";
import { getItem, setItem } from "@/lib/storage";
import type { Lead } from "@/types";

// Same activeLegacyKey()-resolved read-transform-write shape as
// demoQuotesRepository.ts — leads has been one of the MIGRATED_KEYS
// entities since Phase 3A; this phase's v2 -> v3 migration step now also
// stringifies its own id and renames the legacy producer field to
// assignedProducerName (see lib/localDataMigrations.ts), so an existing
// browser's data carries over.

function toLead(input: NewLeadInput, id: string): Lead {
  return {
    id,
    clientId: input.clientId,
    clientName: input.clientName,
    insuranceType: input.insuranceType,
    stage: input.stage,
    assignedProducerName: input.assignedProducerName,
    priority: input.priority,
    lastContact: input.lastContact ?? new Date().toISOString(),
    phone: input.phone,
    email: input.email,
    isDemo: input.isDemo ?? false,
  };
}

async function withMigratedKey<T>(
  fn: (key: string) => Result<T, DataBackendError>
): Promise<Result<T, DataBackendError>> {
  const migrated = await ensureLocalDataMigrated();
  if (!migrated.ok) return migrated;

  const keyResult = activeLegacyKey("leads");
  if (!keyResult.ok) return keyResult;

  return fn(keyResult.data);
}

export const demoLeadsRepository: LeadsRepository = {
  async list() {
    return withMigratedKey((key) => ({ ok: true, data: getItem<Lead[]>(key, []) }));
  },

  async create(input) {
    return withMigratedKey((key) => {
      const leads = getItem<Lead[]>(key, []);
      const lead = toLead(input, String(Date.now()));
      setItem(key, [lead, ...leads]);
      return { ok: true, data: lead };
    });
  },

  async update(id, patch) {
    return withMigratedKey((key) => {
      const leads = getItem<Lead[]>(key, []);
      let updated: Lead | null = null;
      const next = leads.map((lead) => {
        if (lead.id !== id) return lead;
        updated = { ...lead, ...patch };
        return updated;
      });
      if (!updated) {
        return { ok: false, error: { kind: "validation", message: `No demo lead with id ${id}` } };
      }
      setItem(key, next);
      return { ok: true, data: updated };
    });
  },

  async delete(id) {
    return withMigratedKey((key) => {
      const leads = getItem<Lead[]>(key, []);
      setItem(
        key,
        leads.filter((lead) => lead.id !== id)
      );
      return { ok: true, data: undefined };
    });
  },

  async createDemoBatch(inputs) {
    return withMigratedKey((key) => {
      const leads = getItem<Lead[]>(key, []);
      const created = inputs.map((input, index) => toLead({ ...input, isDemo: true }, `${Date.now()}-${index}`));
      setItem(key, [...created, ...leads]);
      return { ok: true, data: created };
    });
  },

  async clearAgencyDemoLeads() {
    return withMigratedKey((key) => {
      const leads = getItem<Lead[]>(key, []);
      const remaining = leads.filter((lead) => !lead.isDemo);
      const deletedCount = leads.length - remaining.length;
      setItem(key, remaining);
      return { ok: true, data: { deletedCount } };
    });
  },
};
