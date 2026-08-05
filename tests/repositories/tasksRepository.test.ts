import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestAgency,
  createTestUser,
  deleteTestAgency,
  deleteTestUser,
  serviceClient,
  type TestUser,
} from "../rls/helpers";
import { createTasksRepository } from "@/lib/repositories/tasksRepository";

// Mirrors documentsRepository.test.ts's structure: ownership/reassignment/
// is_demo hardening proven through the actual factory-produced repository.

const admin = serviceClient();

let agencyId: string;
let otherAgencyId: string;
let producerA: TestUser;
let producerB: TestUser;
let adminUser: TestUser;
let otherAgencyAdmin: TestUser;

beforeAll(async () => {
  agencyId = await createTestAgency(admin, `Tasks Test Agency ${Date.now()}`);
  otherAgencyId = await createTestAgency(admin, `Tasks Other Agency ${Date.now()}`);

  producerA = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer A" });
  producerB = await createTestUser(admin, { agencyId, role: "producer", fullName: "Producer B" });
  adminUser = await createTestUser(admin, { agencyId, role: "admin", fullName: "Agency Admin" });
  otherAgencyAdmin = await createTestUser(admin, {
    agencyId: otherAgencyId,
    role: "admin",
    fullName: "Other Agency Admin",
  });
});

afterAll(async () => {
  await deleteTestUser(admin, producerA?.userId);
  await deleteTestUser(admin, producerB?.userId);
  await deleteTestUser(admin, adminUser?.userId);
  await deleteTestUser(admin, otherAgencyAdmin?.userId);
  await deleteTestAgency(admin, agencyId);
  await deleteTestAgency(admin, otherAgencyId);
});

describe("createTasksRepository — ownership and reassignment through the real repository", () => {
  it("a producer's create() defaults assigned_to to themselves when omitted", async () => {
    const repoA = createTasksRepository(producerA.client, agencyId);
    const result = await repoA.create({ title: "Own task", priority: "Medium", dueDate: "2026-01-01", status: "Open" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedToId).toBe(producerA.userId);
  });

  it("a producer only lists their own tasks; an admin lists everyone's", async () => {
    const repoA = createTasksRepository(producerA.client, agencyId);
    const repoB = createTasksRepository(producerB.client, agencyId);
    const repoAdmin = createTasksRepository(adminUser.client, agencyId);

    await repoA.create({ title: "Visible to A", priority: "Medium", dueDate: "2026-01-01", status: "Open" });
    await repoB.create({ title: "Visible to B", priority: "Medium", dueDate: "2026-01-01", status: "Open" });

    const listA = await repoA.list();
    const listAdmin = await repoAdmin.list();

    expect(listA.ok && listA.data.some((t) => t.title === "Visible to B")).toBe(false);
    expect(listAdmin.ok && listAdmin.data.some((t) => t.title === "Visible to A")).toBe(true);
    expect(listAdmin.ok && listAdmin.data.some((t) => t.title === "Visible to B")).toBe(true);
  });

  it("a producer cannot assign a new task to a different producer", async () => {
    const repoA = createTasksRepository(producerA.client, agencyId);
    const result = await repoA.create({
      title: "Reassign attempt",
      priority: "Medium",
      dueDate: "2026-01-01",
      status: "Open",
      assignedToId: producerB.userId,
    });

    // force_owner_tasks() unconditionally overwrites assigned_to for a
    // non-admin caller, regardless of what was requested — this succeeds,
    // but lands assigned to the caller, never the requested target.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedToId).toBe(producerA.userId);
  });

  it("an admin can create a task explicitly assigned to a specific producer", async () => {
    const repoAdmin = createTasksRepository(adminUser.client, agencyId);
    const result = await repoAdmin.create({
      title: "Admin assigned",
      priority: "Medium",
      dueDate: "2026-01-01",
      status: "Open",
      assignedToId: producerB.userId,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedToId).toBe(producerB.userId);
  });

  it("an admin's create() fails with a typed error, not a thrown exception, when assignedToId is omitted", async () => {
    // assigned_to is NOT NULL with no server-side default for an admin
    // caller (force_owner_tasks() only forces it for non-admins) — the UI
    // (TaskModal) always supplies a real id for an admin, but the
    // repository itself must still degrade to a typed Result, not an
    // unhandled exception, if that invariant is ever violated.
    const repoAdmin = createTasksRepository(adminUser.client, agencyId);
    const result = await repoAdmin.create({ title: "No assignee", priority: "Medium", dueDate: "2026-01-01", status: "Open" });
    expect(result.ok).toBe(false);
  });

  it("a producer cannot reassign their own existing task to another producer", async () => {
    const repoA = createTasksRepository(producerA.client, agencyId);
    const created = await repoA.create({ title: "Mine", priority: "Medium", dueDate: "2026-01-01", status: "Open" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoA.update(created.data.id, { assignedToId: producerB.userId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("an admin can reassign an existing task to a different producer", async () => {
    const repoAdmin = createTasksRepository(adminUser.client, agencyId);
    const created = await repoAdmin.create({
      title: "Reassignable",
      priority: "Medium",
      dueDate: "2026-01-01",
      status: "Open",
      assignedToId: producerA.userId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoAdmin.update(created.data.id, { assignedToId: producerB.userId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.assignedToId).toBe(producerB.userId);
  });

  it("delete round-trips for a task the caller owns", async () => {
    const repoA = createTasksRepository(producerA.client, agencyId);
    const created = await repoA.create({ title: "Delete me", priority: "Medium", dueDate: "2026-01-01", status: "Open" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deleted = await repoA.delete(created.data.id);
    expect(deleted.ok).toBe(true);

    const list = await repoA.list();
    expect(list.ok && list.data.some((t) => t.id === created.data.id)).toBe(false);
  });
});

describe("is_demo hardening — tasks (six-point matrix)", () => {
  it("(1) rejects a non-admin's direct INSERT with is_demo = true", async () => {
    const { error } = await producerA.client.from("tasks").insert({
      agency_id: agencyId,
      title: "sneaky-demo",
      due_date: "2026-01-01",
      is_demo: true,
    });
    expect(error).not.toBeNull();
  });

  it("(2) rejects a non-admin flipping an ordinary task's is_demo false -> true", async () => {
    const repoA = createTasksRepository(producerA.client, agencyId);
    const created = await repoA.create({ title: "Ordinary", priority: "Medium", dueDate: "2026-01-01", status: "Open" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await repoA.update(created.data.id, { isDemo: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("(3) rejects a non-admin flipping a demo task's is_demo true -> false", async () => {
    const repoAdmin = createTasksRepository(adminUser.client, agencyId);
    const repoA = createTasksRepository(producerA.client, agencyId);

    const batch = await repoAdmin.createDemoBatch([
      { title: "Demo", priority: "Medium", dueDate: "2026-01-01", status: "Open", assignedToId: producerA.userId },
    ]);
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;

    const result = await repoA.update(batch.data[0].id, { isDemo: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");

    await repoAdmin.clearAgencyDemoTasks();
  });

  it("(4) clear_agency_demo_tasks() rejects a non-admin caller outright", async () => {
    const repoA = createTasksRepository(producerA.client, agencyId);
    const result = await repoA.clearAgencyDemoTasks();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("denied");
  });

  it("(5) admin clear returns the correct deleted count and never removes a non-demo row", async () => {
    const repoAdmin = createTasksRepository(adminUser.client, agencyId);

    const real = await repoAdmin.create({
      title: "Real",
      priority: "Medium",
      dueDate: "2026-01-01",
      status: "Open",
      assignedToId: adminUser.userId,
    });
    expect(real.ok).toBe(true);

    const batch = await repoAdmin.createDemoBatch([
      { title: "Demo A", priority: "Medium", dueDate: "2026-01-01", status: "Open", assignedToId: adminUser.userId },
      { title: "Demo B", priority: "Medium", dueDate: "2026-01-01", status: "Open", assignedToId: adminUser.userId },
    ]);
    expect(batch.ok).toBe(true);

    const cleared = await repoAdmin.clearAgencyDemoTasks();
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.data.deletedCount).toBeGreaterThanOrEqual(2);

    const list = await repoAdmin.list();
    expect(list.ok && list.data.some((t) => t.title === "Real")).toBe(true);
    expect(list.ok && list.data.some((t) => t.title === "Demo A")).toBe(false);
  });

  it("(6) cross-agency isolation: an admin's clear never touches another agency's demo tasks", async () => {
    const repoAdminA = createTasksRepository(adminUser.client, agencyId);
    const repoAdminOther = createTasksRepository(otherAgencyAdmin.client, otherAgencyId);

    const demoOther = await repoAdminOther.createDemoBatch([
      {
        title: "Other agency demo",
        priority: "Medium",
        dueDate: "2026-01-01",
        status: "Open",
        assignedToId: otherAgencyAdmin.userId,
      },
    ]);
    expect(demoOther.ok).toBe(true);

    await repoAdminA.clearAgencyDemoTasks();

    const stillThere = await repoAdminOther.list();
    expect(stillThere.ok && stillThere.data.some((t) => t.title === "Other agency demo")).toBe(true);

    await repoAdminOther.clearAgencyDemoTasks();
  });
});
