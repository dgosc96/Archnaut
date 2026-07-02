import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { getArchitectureSnapshot } from "../../src/db/queries.js";
import { initDbFromFile } from "../../src/db/init-from-file.js";
import { migrateDb } from "../../src/db/migrate.js";
import {
  insertConcern,
  nodeExists,
  patchNode,
  upsertEdge,
  upsertNode,
  workspaceExists,
} from "../../src/db/mutations.js";
import { normalizeArchnautFile } from "../../src/normalize/normalize-archnaut-file.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  migrateDb(db);
  initDbFromFile(normalizeArchnautFile(shopPlatformFixture), db);
  return db;
}

describe("db mutations", () => {
  it("nodeExists returns true for seeded node and false for missing", () => {
    const db = seedDb();
    expect(nodeExists(db, "cmp.api.checkout")).toBe(true);
    expect(nodeExists(db, "cmp.missing")).toBe(false);
    db.close();
  });

  it("workspaceExists returns true for seeded workspace and false for missing", () => {
    const db = seedDb();
    expect(workspaceExists(db, "ws.api")).toBe(true);
    expect(workspaceExists(db, "ws.missing")).toBe(false);
    db.close();
  });

  it("upsertNode creates node with children", () => {
    const db = seedDb();
    upsertNode(db, {
      id: "cmp.new.service",
      name: "New Service",
      kind: "component",
      status: "planned",
      files: ["src/new.ts"],
      workspaceId: "ws.api",
      tags: ["api"],
      tech: ["typescript"],
      description: "A new service",
    });

    const snapshot = getArchitectureSnapshot(db);
    const node = snapshot.nodes.find((n) => n.id === "cmp.new.service");
    expect(node).toMatchObject({
      name: "New Service",
      status: "planned",
      files: ["src/new.ts"],
      tags: ["api"],
      tech: ["typescript"],
      metadata: { description: "A new service" },
    });
    db.close();
  });

  it("upsertNode replaces child rows on second call", () => {
    const db = seedDb();
    upsertNode(db, {
      id: "cmp.new.service",
      name: "New Service",
      kind: "component",
      status: "planned",
      files: ["old.ts"],
      tags: ["old"],
      tech: ["node"],
    });
    upsertNode(db, {
      id: "cmp.new.service",
      name: "New Service",
      kind: "component",
      status: "implemented",
      files: ["new.ts"],
      tags: ["new"],
      tech: ["bun"],
    });

    const snapshot = getArchitectureSnapshot(db);
    const node = snapshot.nodes.find((n) => n.id === "cmp.new.service");
    expect(node?.status).toBe("implemented");
    expect(node?.files).toEqual(["new.ts"]);
    expect(node?.tags).toEqual(["new"]);
    expect(node?.tech).toEqual(["bun"]);
    db.close();
  });

  it("upsertEdge creates and updates edge", () => {
    const db = seedDb();
    upsertEdge(db, {
      id: "edge.test",
      from: "cmp.api.checkout",
      to: "ext.stripe",
      type: "calls",
      status: "planned",
      description: "initial",
    });
    upsertEdge(db, {
      id: "edge.test",
      from: "cmp.api.checkout",
      to: "ext.stripe",
      type: "calls",
      status: "implemented",
    });

    const snapshot = getArchitectureSnapshot(db);
    const edge = snapshot.edges.find((e) => e.id === "edge.test");
    expect(edge?.status).toBe("implemented");
    expect(edge?.metadata).toBeUndefined();
    db.close();
  });

  it("patchNode updates only provided fields", () => {
    const db = seedDb();
    patchNode(db, { id: "cmp.api.checkout", status: "planned" });

    const snapshot = getArchitectureSnapshot(db);
    const node = snapshot.nodes.find((n) => n.id === "cmp.api.checkout");
    expect(node?.status).toBe("planned");
    expect(node?.name).toBe("Checkout Service");
    expect(node?.files).toEqual(["apps/api/src/modules/checkout"]);
    db.close();
  });

  it("patchNode replaces provided child collections", () => {
    const db = seedDb();
    patchNode(db, {
      id: "cmp.api.checkout",
      files: ["old/file.ts"],
      tags: ["old-tag"],
      tech: ["node"],
    });
    patchNode(db, {
      id: "cmp.api.checkout",
      files: ["src/new.ts"],
      tags: ["new-tag"],
      tech: ["bun"],
    });

    const snapshot = getArchitectureSnapshot(db);
    const node = snapshot.nodes.find((n) => n.id === "cmp.api.checkout");
    expect(node?.files).toEqual(["src/new.ts"]);
    expect(node?.tags).toEqual(["new-tag"]);
    expect(node?.tech).toEqual(["bun"]);
    db.close();
  });

  it("patchNode removes description when description is null", () => {
    const db = seedDb();
    patchNode(db, { id: "cmp.api.checkout", description: "has desc" });
    patchNode(db, { id: "cmp.api.checkout", description: null });

    const snapshot = getArchitectureSnapshot(db);
    const node = snapshot.nodes.find((n) => n.id === "cmp.api.checkout");
    expect(node?.metadata).toBeUndefined();
    db.close();
  });

  it("patchNode throws when node is missing", () => {
    const db = seedDb();
    expect(() => patchNode(db, { id: "cmp.missing", name: "X" })).toThrow(
      "Node 'cmp.missing' not found",
    );
    db.close();
  });

  it("insertConcern persists open concern", () => {
    const db = seedDb();
    insertConcern(db, {
      id: "concern.test",
      scope: "cmp.api.checkout",
      severity: "high",
      source: "agent",
      description: "Needs review",
    });

    const snapshot = getArchitectureSnapshot(db);
    expect(snapshot.concerns).toContainEqual({
      id: "concern.test",
      scope: "cmp.api.checkout",
      severity: "high",
      status: "open",
      source: "agent",
      description: "Needs review",
    });
    db.close();
  });
});
