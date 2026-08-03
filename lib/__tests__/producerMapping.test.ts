import { describe, expect, it } from "vitest";
import { mapProducerNameToProfileId } from "@/lib/producerMapping";

const profiles = [
  { id: "profile-1", fullName: "Darren Belizaire" },
  { id: "profile-2", fullName: "Maria Gonzalez" },
];

describe("mapProducerNameToProfileId", () => {
  it("matches an exact name", () => {
    const result = mapProducerNameToProfileId("Darren Belizaire", profiles);
    expect(result).toEqual({ ok: true, profileId: "profile-1" });
  });

  it("matches case-insensitively and trims whitespace", () => {
    const result = mapProducerNameToProfileId("  maria gonzalez  ", profiles);
    expect(result).toEqual({ ok: true, profileId: "profile-2" });
  });

  it("fails loudly on a name with no match, not a silent guess", () => {
    const result = mapProducerNameToProfileId("Nobody Here", profiles);
    expect(result).toEqual({ ok: false, reason: "not_found", name: "Nobody Here" });
  });

  it("fails loudly on an ambiguous (duplicate) name, not a silent first match", () => {
    const duplicated = [...profiles, { id: "profile-3", fullName: "Darren Belizaire" }];
    const result = mapProducerNameToProfileId("Darren Belizaire", duplicated);
    expect(result).toEqual({ ok: false, reason: "ambiguous", name: "Darren Belizaire" });
  });
});
