import type { AccessScope } from "@/hooks/useAccessScope";
import type { DataBackendError } from "@/lib/dataMode";
import { activeLegacyKey, ensureLocalDataMigrated, type LegacyEntityName } from "@/lib/localDataMigrations";
import type { Result } from "@/lib/result";

export type { LegacyEntityName };

// The six still-local, JSON-array-shaped entities' storage key, scoped by
// full access identity in supabase mode so two producers on the same shared
// browser can never read/write each other's local data — even though
// `clients` itself is already protected by real Supabase RLS. In demo mode,
// resolves through the id-format migration's active versioned key, never
// the untouched legacy key, and propagates a migration failure as a typed
// error rather than falling back to anything.
export async function resolveStorageKey(
  entity: LegacyEntityName,
  scope: AccessScope
): Promise<Result<string, DataBackendError>> {
  if (scope.backend === "demo") {
    const migrated = await ensureLocalDataMigrated();
    if (!migrated.ok) return migrated;
    return activeLegacyKey(entity);
  }

  if (scope.status !== "ready") {
    return { ok: false, error: { kind: "not_ready", message: "Access scope is not ready." } };
  }

  return {
    ok: true,
    data: `protectplus-supabase-mode-${scope.agencyId}-${scope.userId}-${scope.role}-${entity}`,
  };
}

// client_notes is a dynamic, per-client, RAW-STRING key — a fundamentally
// different shape from the six JSON-array entities above, so it gets its
// own resolver rather than being folded into resolveStorageKey().
//
// In demo mode there is nothing to migrate at all: `protectplus-client-notes-${clientId}`
// produces the identical key text whether clientId is the number 42 or the
// string "42" (template-literal interpolation stringifies both the same
// way), so the existing raw note text under the legacy key name is already
// valid, unchanged, forever. Synchronous — no migration gate to await.
export function resolveClientNotesKey(
  clientId: string,
  scope: AccessScope
): Result<string, DataBackendError> {
  if (scope.backend === "demo") {
    return { ok: true, data: `protectplus-client-notes-${clientId}` };
  }

  if (scope.status !== "ready") {
    return { ok: false, error: { kind: "not_ready", message: "Access scope is not ready." } };
  }

  return {
    ok: true,
    data: `protectplus-supabase-mode-${scope.agencyId}-${scope.userId}-${scope.role}-client-notes-${clientId}`,
  };
}
