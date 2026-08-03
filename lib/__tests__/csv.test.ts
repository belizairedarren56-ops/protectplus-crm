import { describe, expect, it } from "vitest";
import { clientsToCsv, parseClientsCsv } from "@/lib/csv";
import type { Client } from "@/types";

const client: Client = {
  id: "1",
  firstName: "Jane",
  lastName: "Cooper, Jr.",
  phone: "954-555-2222",
  email: "jane.cooper@example.com",
  policyType: "Auto",
  status: "Active",
  carrier: "State Farm",
  policyNumber: "SF-1000000",
};

describe("CSV export/import roundtrip", () => {
  it("exports and re-imports a client with equivalent field values", () => {
    const csv = clientsToCsv([client]);
    const [imported] = parseClientsCsv(csv);

    expect(imported).toMatchObject({
      firstName: "Jane",
      lastName: "Cooper, Jr.",
      phone: client.phone,
      email: client.email,
      policyType: "Auto",
      status: "Active",
      carrier: "State Farm",
      policyNumber: "SF-1000000",
    });
  });

  it("quotes and escapes fields containing commas correctly", () => {
    const csv = clientsToCsv([client]);
    expect(csv).toContain('"Cooper, Jr."');
  });

  it("returns an empty array for empty input", () => {
    expect(parseClientsCsv("")).toEqual([]);
  });

  it("falls back to defaults for missing optional columns", () => {
    const csv = "firstName,lastName\nJohn,Smith";
    const [imported] = parseClientsCsv(csv);

    expect(imported.policyType).toBe("Auto");
    expect(imported.status).toBe("New Lead");
  });
});
