"use client";

// Phase 2 adds real login, but the CRM data hooks (clients, leads, quotes,
// policies, tasks, ...) are still backed by localStorage until Phase 3
// migrates them one entity at a time. Without this, a signed-in user could
// reasonably mistake this for a real shared, multi-user database — it
// isn't yet. Remove only once every entity is cut over (see the Phase 2
// plan's "no partial-migration messaging state" note).
export function LocalDataBanner() {
  return (
    <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-center text-sm font-semibold text-yellow-200 md:px-8">
      You&apos;re signed in, but client, policy, quote, lead, and task data is still stored
      locally in this browser — it is not yet shared between users or backed by a database.
    </div>
  );
}
