import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { initDbFromFile } from "../../src/db/init-from-file.js";
import { migrateDb } from "../../src/db/migrate.js";
import {
  abandonTask,
  completeTaskRecord,
  findOverlappingActiveTasks,
  findStaleOverlappingTasks,
  getTask,
  insertTask,
  taskPayloadMatches,
  TASK_STALE_MS,
} from "../../src/db/task-mutations.js";
import { normalizeArchnautFile } from "../../src/normalize/normalize-archnaut-file.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  migrateDb(db);
  initDbFromFile(normalizeArchnautFile(shopPlatformFixture), db);
  return db;
}

const NOW = "2026-07-03T12:00:00.000Z";
const STALE = new Date(Date.parse(NOW) - TASK_STALE_MS - 1000).toISOString();

function insertSampleTask(
  db: Database.Database,
  id: string,
  targetNodeIds: string[],
  updatedAt = NOW,
): void {
  insertTask(db, {
    id,
    agentId: "agent-1",
    summary: `Task ${id}`,
    targetNodeIds,
    createdAt: updatedAt,
    updatedAt,
  });
}

describe("task mutations", () => {
  it("insertTask and getTask round-trip target nodes", () => {
    const db = seedDb();
    insertTask(db, {
      id: "task.parent",
      agentId: "agent-p",
      summary: "Parent",
      targetNodeIds: ["cmp.api.checkout"],
      createdAt: NOW,
      updatedAt: NOW,
    });
    insertTask(db, {
      id: "task.checkout",
      agentId: "agent-a",
      summary: "Implement checkout",
      targetNodeIds: ["cmp.api.checkout", "cmp.api.recommendations"],
      plannedFeatureIds: ["cmp.api.recommendations"],
      parentTaskId: "task.parent",
      metadata: { priority: "high" },
      createdAt: NOW,
      updatedAt: NOW,
    });

    const task = getTask(db, "task.checkout");
    expect(task).toMatchObject({
      id: "task.checkout",
      agentId: "agent-a",
      summary: "Implement checkout",
      status: "in_progress",
      targetNodeIds: ["cmp.api.checkout", "cmp.api.recommendations"],
      plannedFeatureIds: ["cmp.api.recommendations"],
      parentTaskId: "task.parent",
      metadata: { priority: "high" },
    });
    db.close();
  });

  it("findOverlappingActiveTasks returns intersecting in_progress tasks", () => {
    const db = seedDb();
    insertSampleTask(db, "task.a", ["cmp.api.checkout"]);
    insertSampleTask(db, "task.b", ["cmp.api.recommendations"]);
    insertSampleTask(db, "task.c", ["cmp.api.catalog"]);

    const overlaps = findOverlappingActiveTasks(db, ["cmp.api.checkout", "cmp.api.recommendations"]);
    expect(overlaps.map((t) => t.id).sort()).toEqual(["task.a", "task.b"]);
    db.close();
  });

  it("findStaleOverlappingTasks filters by updated_at cutoff", () => {
    const db = seedDb();
    insertSampleTask(db, "task.stale", ["cmp.api.checkout"], STALE);
    insertSampleTask(db, "task.fresh", ["cmp.api.checkout"], NOW);

    const staleBefore = new Date(Date.parse(NOW) - TASK_STALE_MS).toISOString();
    const stale = findStaleOverlappingTasks(db, ["cmp.api.checkout"], staleBefore);
    expect(stale.map((t) => t.id)).toEqual(["task.stale"]);

    const active = findOverlappingActiveTasks(db, ["cmp.api.checkout"]);
    expect(active.map((t) => t.id).sort()).toEqual(["task.fresh", "task.stale"]);
    db.close();
  });

  it("abandonTask and completeTaskRecord transition status", () => {
    const db = seedDb();
    insertSampleTask(db, "task.x", ["cmp.api.checkout"]);

    abandonTask(db, "task.x", "2026-07-03T13:00:00.000Z");
    expect(getTask(db, "task.x")?.status).toBe("abandoned");

    insertSampleTask(db, "task.y", ["cmp.api.catalog"]);
    completeTaskRecord(db, "task.y", "completed", "2026-07-03T14:00:00.000Z", "done");
    const completed = getTask(db, "task.y");
    expect(completed?.status).toBe("completed");
    expect(completed?.notes).toBe("done");

    expect(() => abandonTask(db, "task.missing", "2026-07-03T15:00:00.000Z")).toThrow();
    expect(() =>
      completeTaskRecord(db, "task.missing", "completed", "2026-07-03T15:00:00.000Z"),
    ).toThrow();
    db.close();
  });

  it("abandonTask rejects tasks that are not in_progress", () => {
    const db = seedDb();
    insertSampleTask(db, "task.x", ["cmp.api.checkout"]);
    completeTaskRecord(db, "task.x", "completed", "2026-07-03T14:00:00.000Z");

    expect(() => abandonTask(db, "task.x", "2026-07-03T15:00:00.000Z")).toThrow(
      "Task 'task.x' not found",
    );
    expect(getTask(db, "task.x")?.status).toBe("completed");
    db.close();
  });

  it("taskPayloadMatches compares sorted target and planned feature ids", () => {
    const db = seedDb();
    insertTask(db, {
      id: "task.z",
      agentId: "agent-a",
      summary: "Same payload",
      targetNodeIds: ["cmp.b", "cmp.a"],
      plannedFeatureIds: ["cmp.b", "cmp.a"],
      metadata: { x: 1 },
      createdAt: NOW,
      updatedAt: NOW,
    });
    const task = getTask(db, "task.z");
    if (!task) throw new Error("missing task");

    expect(
      taskPayloadMatches(task, {
        agentId: "agent-a",
        summary: "Same payload",
        targetNodeIds: ["cmp.a", "cmp.b"],
        plannedFeatureIds: ["cmp.a", "cmp.b"],
        metadata: { x: 1 },
      }),
    ).toBe(true);

    expect(
      taskPayloadMatches(task, {
        agentId: "agent-a",
        summary: "Different summary",
        targetNodeIds: ["cmp.a", "cmp.b"],
      }),
    ).toBe(false);
    db.close();
  });

  it("taskPayloadMatches treats metadata key order as insignificant", () => {
    const db = seedDb();
    insertTask(db, {
      id: "task.meta-order",
      agentId: "agent-a",
      summary: "Same payload",
      targetNodeIds: ["cmp.ui"],
      metadata: { a: 1, b: 2, nested: { z: 3, y: 4 } },
      createdAt: NOW,
      updatedAt: NOW,
    });
    const task = getTask(db, "task.meta-order");
    if (!task) throw new Error("missing task");

    expect(
      taskPayloadMatches(task, {
        agentId: "agent-a",
        summary: "Same payload",
        targetNodeIds: ["cmp.ui"],
        metadata: { b: 2, a: 1, nested: { y: 4, z: 3 } },
      }),
    ).toBe(true);
    db.close();
  });

  it("taskPayloadMatches still rejects different metadata values", () => {
    const db = seedDb();
    insertTask(db, {
      id: "task.meta-diff",
      agentId: "agent-a",
      summary: "Same payload",
      targetNodeIds: ["cmp.ui"],
      metadata: { a: 1 },
      createdAt: NOW,
      updatedAt: NOW,
    });
    const task = getTask(db, "task.meta-diff");
    if (!task) throw new Error("missing task");

    expect(
      taskPayloadMatches(task, {
        agentId: "agent-a",
        summary: "Same payload",
        targetNodeIds: ["cmp.ui"],
        metadata: { a: 2 },
      }),
    ).toBe(false);
    db.close();
  });
});
