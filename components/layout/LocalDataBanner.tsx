"use client";

import { getDataBackend } from "@/lib/dataMode";

// Entities not yet migrated off localStorage — one entry removed per future
// Phase 3 slice (3B: policies/quotes/tasks/documents/notes/family members,
// 3C: leads, 3D: notifications), so the banner's copy doesn't need another
// wording review every phase, just this list trimmed.
const NOT_YET_MIGRATED = ["policy", "quote", "lead", "task", "document", "note", "and notification"];

function notYetMigratedList(): string {
  if (NOT_YET_MIGRATED.length === 1) return NOT_YET_MIGRATED[0];
  return `${NOT_YET_MIGRATED.slice(0, -1).join(", ")} ${NOT_YET_MIGRATED[NOT_YET_MIGRATED.length - 1]}`;
}

// Deliberately makes no claim about auth/session state ("You're signed
// in...") — this banner also renders when Supabase isn't configured at all,
// and a false "signed in" claim there would be actively misleading rather
// than just incomplete.
export function LocalDataBanner() {
  const backend = getDataBackend();

  if (backend === "supabase") {
    return (
      <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-center text-sm font-semibold text-yellow-200 md:px-8">
        Client data is backed by Supabase and shared across your team. {capitalize(notYetMigratedList())} data
        is still stored locally in this browser — it is not yet shared between users or backed by a database.
      </div>
    );
  }

  return (
    <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-center text-sm font-semibold text-yellow-200 md:px-8">
      Client, policy, quote, lead, and task data is still stored locally in this browser — it is
      not yet shared between users or backed by a database.
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
