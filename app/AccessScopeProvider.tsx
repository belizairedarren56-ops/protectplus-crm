"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient, skipToken } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessScopeContext, type AccessScope, type Role } from "@/hooks/useAccessScope";
import type { DataBackend } from "@/lib/dataMode";
import type { Database } from "@/lib/supabase/database.types";

const SupabaseClientContext = createContext<SupabaseClient<Database> | null>(null);
export const useSupabaseClient = () => useContext(SupabaseClientContext);
export const SupabaseClientProvider = SupabaseClientContext.Provider;

type OwnProfile = { agencyId: string; role: Role };

async function fetchOwnProfile(supabase: SupabaseClient<Database>, userId: string): Promise<OwnProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("agency_id, role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw error ?? new Error("No profile found for the current user.");
  }
  return { agencyId: data.agency_id, role: data.role };
}

type LastKnownScope = { userId: string | null; agencyId: string | null; role: Role | null };

/**
 * Owns the whole AccessScope state machine. Splits the auth listener
 * (synchronous, identity-only — Supabase's own guidance warns that calling
 * another async Supabase method from inside onAuthStateChange risks
 * deadlocking later calls) from the profile fetch (a fully separate,
 * independent TanStack Query). `scope` is recomputed fresh every render
 * from `authUserId` + the profile query's own status — never held as
 * separately-lagging state — so an identity change falls through to
 * "loading" on the very next render, with no window where a descendant
 * could observe the previous identity's ready scope or cached data.
 */
export function AccessScopeProvider({ backend, children }: { backend: DataBackend; children: ReactNode }) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  const [authUserId, setAuthUserId] = useState<string | null | "unknown">(
    backend === "demo" ? null : "unknown"
  );
  const lastScope = useRef<LastKnownScope>({ userId: null, agencyId: null, role: null });

  useEffect(() => {
    if (backend !== "supabase" || !supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // SYNCHRONOUS ONLY below — no await, no other Supabase calls in this
      // callback. Identity capture + cache clearing only; the profile fetch
      // is a fully separate query below, decoupled from this callback.
      const nextUserId = session?.user.id ?? null;
      if (event === "SIGNED_OUT" || nextUserId !== lastScope.current.userId) {
        queryClient.clear();
        lastScope.current = { userId: null, agencyId: null, role: null };
      }
      setAuthUserId(nextUserId);
    });

    return () => subscription.unsubscribe();
  }, [backend, supabase, queryClient]);

  const profileQuery = useQuery({
    queryKey: ["own-profile", authUserId],
    queryFn:
      supabase && typeof authUserId === "string"
        ? () => fetchOwnProfile(supabase, authUserId)
        : skipToken,
  });

  useEffect(() => {
    if (!profileQuery.data || typeof authUserId !== "string") return;
    const next: LastKnownScope = {
      userId: authUserId,
      agencyId: profileQuery.data.agencyId,
      role: profileQuery.data.role,
    };
    const prev = lastScope.current;
    // Clear on ANY of userId/agencyId/role changing, not just sign-out —
    // catches a role/agency change that wasn't preceded by a sign-out event.
    // (Relative to whenever this query refetches — window refocus,
    // reconnect, next mount — not a live push; that would need Realtime.)
    if (prev.userId !== next.userId || prev.agencyId !== next.agencyId || prev.role !== next.role) {
      queryClient.clear();
    }
    lastScope.current = next;
  }, [profileQuery.data, authUserId, queryClient]);

  const scope: AccessScope = useMemo((): AccessScope => {
    if (backend === "demo") {
      return { status: "ready", backend: "demo", agencyId: null, userId: null, role: null };
    }
    if (authUserId === "unknown") return { status: "loading", backend: "supabase" };
    if (authUserId === null) return { status: "unauthenticated", backend: "supabase" };
    if (profileQuery.isPending) return { status: "loading", backend: "supabase" };
    if (profileQuery.isError) {
      return {
        status: "error",
        backend: "supabase",
        error: { kind: "unknown", message: profileQuery.error.message, cause: profileQuery.error },
      };
    }
    if (!supabase) return { status: "loading", backend: "supabase" }; // defensive; ConfiguredProviders guarantees this never actually happens
    return {
      status: "ready",
      backend: "supabase",
      agencyId: profileQuery.data.agencyId,
      userId: authUserId,
      role: profileQuery.data.role,
      supabaseClient: supabase,
    };
  }, [
    backend,
    authUserId,
    profileQuery.isPending,
    profileQuery.isError,
    profileQuery.error,
    profileQuery.data,
    supabase,
  ]);

  return (
    <AccessScopeContext.Provider value={scope}>
      <UnauthenticatedGate>{children}</UnauthenticatedGate>
    </AccessScopeContext.Provider>
  );
}

/**
 * Hides protected content and redirects to /login the instant the scope
 * becomes "unauthenticated" — never lets an entity hook render an
 * empty-but-apparently-successful CRM view during that window. Wraps the
 * ENTIRE app (including /login itself), so it must not block /login's own
 * content: every visitor to /login is, by definition, unauthenticated —
 * that's the expected, normal case for that one route.
 */
function UnauthenticatedGate({ children }: { children: ReactNode }) {
  const scope = useContext(AccessScopeContext);
  const pathname = usePathname();
  const router = useRouter();

  const isLoginRoute = pathname === "/login";
  const isBlocked = scope?.status === "unauthenticated" && !isLoginRoute;

  useEffect(() => {
    if (isBlocked) router.replace("/login");
  }, [isBlocked, router]);

  if (isBlocked) return null; // protected route, no session: hide content, redirect in flight
  return <>{children}</>; // /login itself, or any authenticated/loading/demo state: render normally
}
