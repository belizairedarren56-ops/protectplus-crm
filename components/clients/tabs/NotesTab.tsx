"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useClientNotes } from "@/hooks/useClientNotes";

export function NotesTab({ clientId }: { clientId: string }) {
  const { note, loaded, isError, error, saveNote } = useClientNotes(clientId);

  const [draft, setDraft] = useState("");
  const [syncedNote, setSyncedNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Adjust state during render, not in an effect: once `loaded` is true,
  // sync the draft to whatever note the query cache currently holds for
  // THIS clientId/scope. TanStack Query's own queryKey-based cache already
  // guarantees a clientId/scope change never returns the previous key's
  // data, and the `!loaded` early return below means nothing renders here
  // until the new client's note has actually arrived — so this sync can
  // never show a stale client's text, even for one render.
  if (loaded && syncedNote !== note) {
    setDraft(note);
    setSyncedNote(note);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await saveNote(draft);
    if (!result.ok) setSaveError(result.error.message);
    setSaving(false);
  }

  if (isError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        Could not load notes{error ? `: ${error.message}` : "."}
      </p>
    );
  }

  if (!loaded) {
    return <p className="text-sm text-gray-500">Loading notes...</p>;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Save follow-ups, coverage questions, and client details.
      </p>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Example: Call Friday to discuss umbrella coverage..."
        className="min-h-48 w-full rounded-xl border border-gray-700 bg-black px-4 py-4 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500"
      />

      {saveError && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {saveError}
        </p>
      )}

      <Button className="mt-4" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Notes"}
      </Button>
    </div>
  );
}
