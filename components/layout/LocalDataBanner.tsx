"use client";

// Phase 2 adds real login, but the CRM data hooks (clients, leads, quotes,
// policies, tasks, ...) are still backed by localStorage until Phase 3
// migrates them one entity at a time. Without this, someone could
// reasonably mistake this for a real shared, multi-user database — it
// isn't yet. Remove only once every entity is cut over (see the Phase 2
// plan's "no partial-migration messaging state" note).
//
// Deliberately makes no claim about auth/session state ("You're signed
// in...") — this banner also renders when Supabase isn't configured at all
// (proxy.ts no-ops in that case, per the Phase 2 plan, so there's no
// session to speak of), and a false "signed in" claim there would be
// actively misleading rather than just incomplete.
export function LocalDataBanner() {
  return (
    <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-center text-sm font-semibold text-yellow-200 md:px-8">
      Client, policy, quote, lead, and task data is still stored locally in this browser — it is
      not yet shared between users or backed by a database.
    </div>
  );
}
