export function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Could not parse localStorage key "${key}":`, error);
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

// Plain (non-JSON) string accessors — client notes have always been stored
// as a raw string, not a JSON-encoded one. Keeping these separate preserves
// backward compatibility with notes saved before this module existed.
export function getRawItem(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export function setRawItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

export const STORAGE_KEYS = {
  clients: "protectplus-clients",
  leads: "protectplus-leads",
  quotes: "protectplus-quotes",
  policies: "protectplus-policies",
  tasks: "protectplus-tasks",
  documents: "protectplus-documents",
  notifications: "protectplus-notifications",
  clientNotes: (clientId: number) => `protectplus-client-notes-${clientId}`,
} as const;
