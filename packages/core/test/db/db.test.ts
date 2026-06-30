import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { getArchitectureSnapshot } from "../../src/db/queries.js";
import { initDbFromFile } from "../../src/db/init-from-file.js";
import { migrateDb, clearDb, clearNodesAndEdges } from "../../src/db/migrate.js";
import { rebuildDbFromFile } from "../../src/db/rebuild-from-file.js";
import { normalizeArchnautFile } from "../../src/normalize/normalize-archnaut-file.js";
import { saveArchnautFile } from "../../src/repository/save.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "archnaut-db-"));
  tempDirs.push(dir);
  return dir;
}

describe("SQLite projection", () => {
  it("round-trips file → db → snapshot", () => {
    const db = new Database(":memory:");
    migrateDb(db);
    const normalized = normalizeArchnautFile(shopPlatformFixture);
    initDbFromFile(normalized, db);
    const snapshot = getArchitectureSnapshot(db);
    expect(snapshot.project.id).toBe(normalized.project.id);
    expect(snapshot.nodes.map((n) => n.id)).toEqual(normalized.nodes.map((n) => n.id));
    expect(snapshot.edges.map((e) => e.id)).toEqual(normalized.edges.map((e) => e.id));
    db.close();
  });

  it("rebuild is idempotent", async () => {
    const dir = await makeTempDir();
    const jsonPath = path.join(dir, "archnaut.json");
    const dbPath = path.join(dir, "db.sqlite");
    await saveArchnautFile(jsonPath, shopPlatformFixture);

    await rebuildDbFromFile(jsonPath, dbPath);
    await rebuildDbFromFile(jsonPath, dbPath);

    const db = new Database(dbPath);
    const snapshot = getArchitectureSnapshot(db);
    expect(snapshot.nodes.length).toBe(shopPlatformFixture.nodes.length);
    db.close();
  });

  it("rebuild normalizes loaded file", async () => {
    const dir = await makeTempDir();
    const jsonPath = path.join(dir, "archnaut.json");
    const dbPath = path.join(dir, "db.sqlite");
    const shuffled = {
      ...shopPlatformFixture,
      edges: [...shopPlatformFixture.edges].reverse(),
      nodes: [...shopPlatformFixture.nodes].reverse(),
    };
    await saveArchnautFile(jsonPath, shuffled, { normalize: false });

    await rebuildDbFromFile(jsonPath, dbPath);

    const db = new Database(dbPath);
    const snapshot = getArchitectureSnapshot(db);
    const normalized = normalizeArchnautFile(shopPlatformFixture);
    expect(snapshot.edges.map((e) => e.id)).toEqual(normalized.edges.map((e) => e.id));
    expect(snapshot.nodes.map((n) => n.id)).toEqual(normalized.nodes.map((n) => n.id));
    db.close();
  });

  it("clearDb removes all rows", () => {
    const db = new Database(":memory:");
    migrateDb(db);
    initDbFromFile(normalizeArchnautFile(shopPlatformFixture), db);
    clearDb(db);
    const count = db.prepare(`SELECT COUNT(*) AS c FROM nodes`).get() as { c: number };
    expect(count.c).toBe(0);
    db.close();
  });

  it("clearNodesAndEdges removes graph rows but keeps project and workspaces", () => {
    const db = new Database(":memory:");
    migrateDb(db);
    const normalized = normalizeArchnautFile(shopPlatformFixture);
    initDbFromFile(normalized, db);
    clearNodesAndEdges(db);

    const nodes = db.prepare(`SELECT COUNT(*) AS c FROM nodes`).get() as { c: number };
    const edges = db.prepare(`SELECT COUNT(*) AS c FROM edges`).get() as { c: number };
    const concerns = db.prepare(`SELECT COUNT(*) AS c FROM concerns`).get() as { c: number };
    const project = db.prepare(`SELECT COUNT(*) AS c FROM project`).get() as { c: number };
    const workspaces = db.prepare(`SELECT COUNT(*) AS c FROM workspaces`).get() as { c: number };
    expect(nodes.c).toBe(0);
    expect(edges.c).toBe(0);
    expect(concerns.c).toBe(0);
    expect(project.c).toBe(1);
    expect(workspaces.c).toBe(normalized.workspaces.length);

    const nodeFiles = db.prepare(`SELECT COUNT(*) AS c FROM node_files`).get() as { c: number };
    const nodeTags = db.prepare(`SELECT COUNT(*) AS c FROM node_tags`).get() as { c: number };
    const nodeTech = db.prepare(`SELECT COUNT(*) AS c FROM node_tech`).get() as { c: number };
    expect(nodeFiles.c).toBe(0);
    expect(nodeTags.c).toBe(0);
    expect(nodeTech.c).toBe(0);

    const snapshot = getArchitectureSnapshot(db);
    expect(snapshot.project.id).toBe(normalized.project.id);
    expect(snapshot.workspaces).toEqual(normalized.workspaces);
    expect(snapshot.nodes).toHaveLength(0);
    expect(snapshot.edges).toHaveLength(0);
    expect(snapshot.concerns).toHaveLength(0);
    expect(snapshot.meta).toEqual(normalized.meta);
    db.close();
  });
});
