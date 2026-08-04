"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { scopeFingerprint, useAccessScope } from "@/hooks/useAccessScope";
import { resolveClientNotesKey } from "@/lib/scopedStorage";
import { getRawItem, setRawItem } from "@/lib/storage";

export function NotesTab({ clientId }: { clientId: string }) {
  const scope = useAccessScope();
  const fingerprint = scopeFingerprint(`client-notes-${clientId}`, scope);

  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [dataFingerprint, setDataFingerprint] = useState<string | null>(null);

  // Same render-time reset technique as useLocalStorageList: navigating from
  // one client to another (or an identity change) must never show the
  // previous client's note text for even one render.
  if (fingerprint !== dataFingerprint) {
    setNotes("");
    setLoaded(false);
    setActiveKey(null);
    setDataFingerprint(fingerprint);
  }

  useEffect(() => {
    // resolveClientNotesKey is fully synchronous (no migration gate for
    // notes — see lib/scopedStorage.ts), but the read still has to happen
    // in an effect: reading real localStorage content during the server/
    // first-client render would produce a hydration mismatch.
    const keyResult = resolveClientNotesKey(clientId, scope);
    if (!keyResult.ok) return;
    // localStorage isn't available during SSR, so this has to run post-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(getRawItem(keyResult.data));
    setActiveKey(keyResult.data);
    setLoaded(true);
  }, [clientId, scope]);

  function saveNotes() {
    if (!activeKey || fingerprint !== dataFingerprint) return;
    setRawItem(activeKey, notes);
    alert("Notes saved.");
  }

  if (fingerprint !== dataFingerprint || !loaded) {
    return <p className="text-sm text-gray-500">Loading notes...</p>;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Save follow-ups, coverage questions, and client details.
      </p>

      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Example: Call Friday to discuss umbrella coverage..."
        className="min-h-48 w-full rounded-xl border border-gray-700 bg-black px-4 py-4 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500"
      />

      <Button className="mt-4" onClick={saveNotes}>
        Save Notes
      </Button>
    </div>
  );
}
