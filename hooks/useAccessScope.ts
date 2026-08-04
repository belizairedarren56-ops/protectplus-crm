"use client";

import { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataBackend, DataBackendError } from "@/lib/dataMode";
import type { Database } from "@/lib/supabase/database.types";

export type Role = "admin" | "producer";

// The single, shared identity concept every query key, storage key, and
// cache-clearing check is derived from. `backend` is present on every
// variant (it's known synchronously from getDataBackend(), independent of
// auth/profile loading) so callers never need to narrow on `status` before
// reading it.
export type AccessScope =
  | { status: "loading"; backend: DataBackend }
  | { status: "unauthenticated"; backend: "supabase" }
  | { status: "error"; backend: "supabase"; error: DataBackendError }
  | { status: "ready"; backend: "demo"; agencyId: null; userId: null; role: null }
  | {
      status: "ready";
      backend: "supabase";
      agencyId: string;
      userId: string;
      role: Role;
      supabaseClient: SupabaseClient<Database>;
    };

export const AccessScopeContext = createContext<AccessScope | null>(null);

export function useAccessScope(): AccessScope {
  const scope = useContext(AccessScopeContext);
  if (!scope) {
    throw new Error("useAccessScope must be used within an AccessScopeProvider");
  }
  return scope;
}

// Shared by both the clients query key and the storage-key resolvers in
// lib/scopedStorage.ts, and reused for the render-time stale-state guard in
// useLocalStorageList/NotesTab (see correction 4.2.2/4.2.3) — one function,
// one definition of "what makes two scopes the same" everywhere it matters.
export function scopeFingerprint(subject: string, scope: AccessScope): string {
  return JSON.stringify([
    subject,
    scope.backend,
    scope.status,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ]);
}
