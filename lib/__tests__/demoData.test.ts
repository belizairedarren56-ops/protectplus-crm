import { describe, expect, it } from "vitest";
import { generateDemoData } from "@/lib/demoData";

describe("generateDemoData", () => {
  it("tags every generated record isDemo: true", () => {
    const demo = generateDemoData(1);

    expect(demo.clients.length).toBeGreaterThan(0);
    expect(demo.clients.every((client) => client.isDemo === true)).toBe(true);
    expect(demo.policies.every((policy) => policy.isDemo === true)).toBe(true);
    expect(demo.leads.every((lead) => lead.isDemo === true)).toBe(true);
    expect(demo.quotes.every((quote) => quote.isDemo === true)).toBe(true);
    expect(demo.tasks.every((task) => task.isDemo === true)).toBe(true);
    expect(demo.documents.every((document) => document.isDemo === true)).toBe(true);
    expect(demo.notifications.every((notification) => notification.isDemo === true)).toBe(true);
  });

  it("generates the expected record counts", () => {
    const demo = generateDemoData(1);

    expect(demo.clients).toHaveLength(50);
    expect(demo.policies).toHaveLength(25);
    expect(demo.leads).toHaveLength(20);
    expect(demo.quotes).toHaveLength(15);
    expect(demo.tasks).toHaveLength(30);
  });

  it("every generated quote and policy references a real generated client", () => {
    const demo = generateDemoData(1);
    const clientIds = new Set(demo.clients.map((client) => client.id));

    for (const quote of demo.quotes) {
      expect(clientIds.has(quote.clientId)).toBe(true);
    }
    for (const policy of demo.policies) {
      expect(clientIds.has(policy.clientId)).toBe(true);
    }
  });

  it("produces unique ids across every entity in a single generation", () => {
    const demo = generateDemoData(1);
    const allIds = [
      ...demo.clients.map((c) => c.id),
      ...demo.policies.map((p) => p.id),
      ...demo.leads.map((l) => l.id),
      ...demo.quotes.map((q) => q.id),
      ...demo.tasks.map((t) => t.id),
      ...demo.documents.map((d) => d.id),
      ...demo.notifications.map((n) => n.id),
    ];

    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
