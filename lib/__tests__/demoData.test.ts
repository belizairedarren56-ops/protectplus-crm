import { describe, expect, it } from "vitest";
import { generateDemoClientDrafts, generateDemoDataForClients } from "@/lib/demoData";
import type { Client } from "@/types";

function resolveClients(count = 50): Client[] {
  const drafts = generateDemoClientDrafts(count);
  return drafts.map((draft, index) => ({
    id: String(1000 + index),
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone: draft.phone,
    email: draft.email,
    policyType: draft.policyType,
    status: draft.status,
    address: draft.address,
    city: draft.city,
    state: draft.state,
    zip: draft.zip,
    carrier: draft.carrier,
    policyNumber: draft.policyNumber,
    insuranceTypes: draft.insuranceTypes,
    createdAt: draft.createdAt,
    assignedProducerName: draft.assignedProducerName,
    isDemo: true,
  }));
}

describe("generateDemoClientDrafts", () => {
  it("tags every generated draft isDemo: true and produces no ids", () => {
    const drafts = generateDemoClientDrafts(50);
    expect(drafts).toHaveLength(50);
    expect(drafts.every((draft) => draft.isDemo === true)).toBe(true);
    expect(drafts.every((draft) => !("id" in draft))).toBe(true);
  });
});

describe("generateDemoDataForClients", () => {
  it("tags every generated record isDemo: true", () => {
    const clients = resolveClients();
    const demo = generateDemoDataForClients(1, clients);

    expect(demo.policies.every((policy) => policy.isDemo === true)).toBe(true);
    expect(demo.leads.every((lead) => lead.isDemo === true)).toBe(true);
    expect(demo.quotes.every((quote) => quote.isDemo === true)).toBe(true);
    expect(demo.tasks.every((task) => task.isDemo === true)).toBe(true);
    expect(demo.documents.every((document) => document.isDemo === true)).toBe(true);
    expect(demo.notifications.every((notification) => notification.isDemo === true)).toBe(true);
  });

  it("generates the expected record counts", () => {
    const clients = resolveClients();
    const demo = generateDemoDataForClients(1, clients);

    expect(demo.policies).toHaveLength(25);
    expect(demo.leads).toHaveLength(20);
    expect(demo.quotes).toHaveLength(15);
    expect(demo.tasks).toHaveLength(30);
  });

  it("every generated quote and policy references a real, resolved client", () => {
    const clients = resolveClients();
    const demo = generateDemoDataForClients(1, clients);
    const clientIds = new Set(clients.map((client) => client.id));

    for (const quote of demo.quotes) {
      expect(clientIds.has(quote.clientId)).toBe(true);
    }
    for (const policy of demo.policies) {
      expect(clientIds.has(policy.clientId)).toBe(true);
    }
  });

  it("produces unique ids across every generated entity with a generator-assigned id", () => {
    // documents, tasks, and family_members carry no numeric id of their
    // own — all three are created through their real repository (see
    // useDemoData.ts), which assigns the id, so there's nothing to check
    // uniqueness against here.
    const clients = resolveClients();
    const demo = generateDemoDataForClients(1, clients);
    const allIds = [
      ...demo.policies.map((p) => p.id),
      ...demo.leads.map((l) => l.id),
      ...demo.quotes.map((q) => q.id),
      ...demo.notifications.map((n) => n.id),
    ];

    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("returns empty arrays when no clients are resolved yet", () => {
    const demo = generateDemoDataForClients(1, []);
    expect(demo.policies).toHaveLength(0);
    expect(demo.leads).toHaveLength(0);
    expect(demo.quotes).toHaveLength(0);
    expect(demo.tasks).toHaveLength(0);
    expect(demo.documents).toHaveLength(0);
    expect(demo.notifications).toHaveLength(0);
    expect(demo.familyMembers).toHaveLength(0);
  });

  it("every generated family member references a real, resolved client and has no id of its own", () => {
    const clients = resolveClients();
    const demo = generateDemoDataForClients(1, clients);
    const clientIds = new Set(clients.map((client) => client.id));

    expect(demo.familyMembers.length).toBeGreaterThan(0);
    for (const member of demo.familyMembers) {
      expect(clientIds.has(member.clientId)).toBe(true);
      expect(member).not.toHaveProperty("id");
    }
  });
});
