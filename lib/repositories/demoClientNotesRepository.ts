import type { AccessScope } from "@/hooks/useAccessScope";
import type { ClientNotesRepository } from "@/lib/repositories/clientNotesRepository";
import { resolveClientNotesKey } from "@/lib/scopedStorage";
import { getRawItem, setRawItem } from "@/lib/storage";

// Wraps the existing resolveClientNotesKey()/getRawItem/setRawItem from
// Phase 3A unchanged — demo mode has no note_type concept at all, it was
// never anything but one raw string per client and stays exactly that.
// A factory (not a plain object like demoClientsRepository) because
// resolveClientNotesKey needs the caller's full scope, not just the
// clientId, to compute the storage key.
export function createDemoClientNotesRepository(scope: AccessScope): ClientNotesRepository {
  return {
    async getProfileNote(clientId) {
      const keyResult = resolveClientNotesKey(clientId, scope);
      if (!keyResult.ok) return keyResult;
      return { ok: true, data: getRawItem(keyResult.data, "") };
    },
    async saveProfileNote(clientId, body) {
      const keyResult = resolveClientNotesKey(clientId, scope);
      if (!keyResult.ok) return keyResult;
      setRawItem(keyResult.data, body);
      return { ok: true, data: body };
    },
  };
}
