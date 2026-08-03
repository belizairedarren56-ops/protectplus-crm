export type ProducerMappingResult =
  | { ok: true; profileId: string }
  | { ok: false; reason: "not_found" | "ambiguous"; name: string };

// Case-insensitive/trimmed match against `profiles.full_name` within the
// target agency; a duplicate name fails exactly like a missing one — no
// silent first-match guessing. Pure, no I/O, unit-tested with mocked
// profile lists.
export function mapProducerNameToProfileId(
  name: string,
  profiles: { id: string; fullName: string }[]
): ProducerMappingResult {
  const normalized = name.trim().toLowerCase();
  const matches = profiles.filter((profile) => profile.fullName.trim().toLowerCase() === normalized);

  if (matches.length === 0) return { ok: false, reason: "not_found", name };
  if (matches.length > 1) return { ok: false, reason: "ambiguous", name };
  return { ok: true, profileId: matches[0].id };
}
