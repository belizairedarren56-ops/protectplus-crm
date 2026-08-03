export type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

// Mandatory adapter at the TanStack Query boundary: a resolved Result<T, E>
// never fails the way useQuery/useMutation need it to (the promise itself
// always resolves). This unwraps it into the throw/reject behavior React
// Query actually depends on for isError/onError/rollback to work, without
// forcing every repository method to use exceptions internally.
export async function unwrap<T, E>(promise: Promise<Result<T, E>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw result.error;
  return result.data;
}
