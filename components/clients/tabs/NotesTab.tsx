"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getRawItem, setRawItem, STORAGE_KEYS } from "@/lib/storage";

export function NotesTab({ clientId }: { clientId: number }) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    // localStorage read must happen post-mount (SSR has no access to it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(getRawItem(STORAGE_KEYS.clientNotes(clientId)));
  }, [clientId]);

  function saveNotes() {
    setRawItem(STORAGE_KEYS.clientNotes(clientId), notes);
    alert("Notes saved.");
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
