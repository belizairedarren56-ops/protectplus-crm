export type DataBackend = "demo" | "supabase";

export type DataBackendErrorKind =
  | "config"
  | "connection"
  | "denied"
  | "validation"
  | "migration"
  | "not_ready"
  | "unknown";

export type DataBackendError = {
  kind: DataBackendErrorKind;
  message: string;
  cause?: unknown;
};

// Thrown only when NEXT_PUBLIC_DATA_BACKEND is unset/invalid in a production
// build — a real Error subclass so it can reach an error boundary, distinct
// from the DataBackendError *value* type used everywhere else in this layer.
export class DataBackendConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataBackendConfigError";
  }
}

// Explicit mode selection, not auto-detection. `demo` is the default outside
// production so local dev/tests work with zero ceremony. In production,
// an unset or invalid value fails closed instead of silently serving demo/
// localStorage data in what's supposed to be a real environment — this is a
// deliberate, narrow exception to "never throw in a plain function," made
// because there is no safe data to fall back to once NODE_ENV=production.
export function getDataBackend(): DataBackend {
  const raw = process.env.NEXT_PUBLIC_DATA_BACKEND;
  if (raw === "supabase") return "supabase";
  if (raw === "demo") return "demo";

  if (process.env.NODE_ENV === "production") {
    throw new DataBackendConfigError(
      `NEXT_PUBLIC_DATA_BACKEND must be explicitly "demo" or "supabase" in production; got ${JSON.stringify(raw)}.`
    );
  }
  return "demo";
}
