import type { DataBackendError } from "@/lib/dataMode";
import type { FamilyMembersRepository, NewFamilyMemberInput } from "@/lib/repositories/familyMembersRepository";
import type { Result } from "@/lib/result";
import { getItem, setItem } from "@/lib/storage";
import type { FamilyMember } from "@/types";

// A new, standalone key — family_members never existed as an independent
// localStorage record before this phase (it was always generated inline
// inside a demo client draft), so there is nothing to migrate into it;
// every existing browser starts with an empty array here. A plain, global
// name — not scoped by access identity — matching every other still-local
// demo-mode entity: demo mode has no real per-user identity to scope by.
const STORAGE_KEY = "protectplus-family-members";

// Date.now() alone (the single-create id scheme demoClientsRepository
// uses) can collide when many family members are created in a tight
// sequential loop, as useDemoData's demo-load step does — a random suffix
// makes every id unique regardless of call pattern, without pushing that
// concern onto every caller.
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toFamilyMember(input: NewFamilyMemberInput, id: string): FamilyMember {
  return {
    id,
    clientId: input.clientId,
    name: input.name,
    relationship: input.relationship,
    dateOfBirth: input.dateOfBirth,
  };
}

function notFound(id: string): Result<FamilyMember, DataBackendError> {
  return { ok: false, error: { kind: "validation", message: `No demo family member with id ${id}` } };
}

export const demoFamilyMembersRepository: FamilyMembersRepository = {
  async list() {
    return { ok: true, data: getItem<FamilyMember[]>(STORAGE_KEY, []) };
  },

  async create(input) {
    const members = getItem<FamilyMember[]>(STORAGE_KEY, []);
    const member = toFamilyMember(input, generateId());
    setItem(STORAGE_KEY, [member, ...members]);
    return { ok: true, data: member };
  },

  async update(id, patch) {
    const members = getItem<FamilyMember[]>(STORAGE_KEY, []);
    let updated: FamilyMember | null = null;
    const next = members.map((member) => {
      if (member.id !== id) return member;
      updated = { ...member, ...patch };
      return updated;
    });
    if (!updated) return notFound(id);
    setItem(STORAGE_KEY, next);
    return { ok: true, data: updated };
  },

  async delete(id) {
    const members = getItem<FamilyMember[]>(STORAGE_KEY, []);
    setItem(
      STORAGE_KEY,
      members.filter((member) => member.id !== id)
    );
    return { ok: true, data: undefined };
  },
};
