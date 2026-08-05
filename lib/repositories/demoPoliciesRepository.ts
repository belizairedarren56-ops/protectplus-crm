import type { DataBackendError } from "@/lib/dataMode";
import { activeLegacyKey, ensureLocalDataMigrated } from "@/lib/localDataMigrations";
import type { NewPolicyInput, PoliciesRepository } from "@/lib/repositories/policiesRepository";
import type { Result } from "@/lib/result";
import { getItem, setItem } from "@/lib/storage";
import type { Policy } from "@/types";

// Same activeLegacyKey()-resolved read-transform-write shape as
// demoQuotesRepository.ts — policies was already one of the seven
// MIGRATED_KEYS entities; its id-format migration now also stringifies its
// own id and renames the legacy producer field to assignedProducerName
// (see lib/localDataMigrations.ts), so an existing browser's data carries
// over.

function toPolicy(input: NewPolicyInput, id: string): Policy {
  return {
    id,
    clientId: input.clientId,
    clientName: input.clientName,
    carrier: input.carrier,
    policyNumber: input.policyNumber,
    product: input.product,
    effectiveDate: input.effectiveDate,
    expirationDate: input.expirationDate,
    status: input.status,
    premium: input.premium,
    assignedProducerName: input.assignedProducerName,
    isDemo: input.isDemo ?? false,
  };
}

async function withMigratedKey<T>(
  fn: (key: string) => Result<T, DataBackendError>
): Promise<Result<T, DataBackendError>> {
  const migrated = await ensureLocalDataMigrated();
  if (!migrated.ok) return migrated;

  const keyResult = activeLegacyKey("policies");
  if (!keyResult.ok) return keyResult;

  return fn(keyResult.data);
}

export const demoPoliciesRepository: PoliciesRepository = {
  async list() {
    return withMigratedKey((key) => ({ ok: true, data: getItem<Policy[]>(key, []) }));
  },

  async create(input) {
    return withMigratedKey((key) => {
      const policies = getItem<Policy[]>(key, []);
      const policy = toPolicy(input, String(Date.now()));
      setItem(key, [policy, ...policies]);
      return { ok: true, data: policy };
    });
  },

  async update(id, patch) {
    return withMigratedKey((key) => {
      const policies = getItem<Policy[]>(key, []);
      let updated: Policy | null = null;
      const next = policies.map((policy) => {
        if (policy.id !== id) return policy;
        updated = { ...policy, ...patch };
        return updated;
      });
      if (!updated) {
        return { ok: false, error: { kind: "validation", message: `No demo policy with id ${id}` } };
      }
      setItem(key, next);
      return { ok: true, data: updated };
    });
  },

  async delete(id) {
    return withMigratedKey((key) => {
      const policies = getItem<Policy[]>(key, []);
      setItem(
        key,
        policies.filter((policy) => policy.id !== id)
      );
      return { ok: true, data: undefined };
    });
  },

  async createDemoBatch(inputs) {
    return withMigratedKey((key) => {
      const policies = getItem<Policy[]>(key, []);
      const created = inputs.map((input, index) =>
        toPolicy({ ...input, isDemo: true }, `${Date.now()}-${index}`)
      );
      setItem(key, [...created, ...policies]);
      return { ok: true, data: created };
    });
  },

  async clearAgencyDemoPolicies() {
    return withMigratedKey((key) => {
      const policies = getItem<Policy[]>(key, []);
      const remaining = policies.filter((policy) => !policy.isDemo);
      const deletedCount = policies.length - remaining.length;
      setItem(key, remaining);
      return { ok: true, data: { deletedCount } };
    });
  },
};
