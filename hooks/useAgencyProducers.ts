"use client";

import { useQuery } from "@tanstack/react-query";
import { type AccessScope, useAccessScope } from "@/hooks/useAccessScope";
import { createProfilesRepository, type AgencyProducer, type ProfilesRepository } from "@/lib/repositories/profilesRepository";
import { unavailableProfilesRepository } from "@/lib/repositories/profilesRepository";
import { unwrap } from "@/lib/result";

function getProfilesRepository(scope: AccessScope): ProfilesRepository {
  if (scope.status !== "ready" || scope.backend !== "supabase") return unavailableProfilesRepository;
  return createProfilesRepository(scope.supabaseClient);
}

function agencyProducersQueryKey(scope: AccessScope) {
  return [
    "profiles",
    "producers",
    scope.backend,
    scope.status === "ready" ? scope.agencyId : null,
    scope.status === "ready" ? scope.userId : null,
    scope.status === "ready" ? scope.role : null,
  ] as const;
}

/**
 * Only ever queried for an admin — a producer never even fires this
 * request, so their cache never contains the agency roster at all. Backed
 * by the same not-ready-safe repository selector pattern as useClients().
 */
export function useAgencyProducers() {
  const scope = useAccessScope();
  const repository = getProfilesRepository(scope);

  return useQuery<AgencyProducer[]>({
    queryKey: agencyProducersQueryKey(scope),
    queryFn: () => unwrap(repository.listAgencyProducers()),
    enabled: scope.status === "ready" && scope.role === "admin",
  });
}
