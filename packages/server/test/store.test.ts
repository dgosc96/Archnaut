import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type Database from "better-sqlite3";

import { getArchitectureSnapshot, saveArchnautFile } from "@archnaut/core";
import { afterEach, describe, expect, it } from "vitest";

import { createStore, SingleStoreError } from "../src/store.js";
import { shopPlatformFixture } from "../../core/test/fixtures/shop-platform.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "archnaut-store-"));
  tempDirs.push(dir);
  return dir;
}

const EMPTY_GRAPH_TABLES = ["nodes", "edges", "workspaces", "concerns"] as const;
type GraphTable = (typeof EMPTY_GRAPH_TABLES)[number];

const COUNT_SQL: Record<GraphTable, string> = {
  nodes: "SELECT COUNT(*) AS c FROM nodes",
  edges: "SELECT COUNT(*) AS c FROM edges",
  workspaces: "SELECT COUNT(*) AS c FROM workspaces",
  concerns: "SELECT COUNT(*) AS c FROM concerns",
};

function tableCount(db: Database.Database, table: GraphTable): number {
  return (db.prepare(COUNT_SQL[table]).get() as { c: number }).c;
}

describe("createStore", () => {
  it("hydrates from existing archnaut.json", async () => {
    const dir = await makeTempDir();
    const jsonPath = path.join(dir, "archnaut.json");
    await saveArchnautFile(jsonPath, shopPlatformFixture);

    const store = await createStore(jsonPath, { dbPath: ":memory:" });

    expect(store.getArchJsonPath()).toBe(jsonPath);
    expect(getArchitectureSnapshot(store.getDb()).nodes).toHaveLength(
      shopPlatformFixture.nodes.length,
    );

    store.close();
  });

  it("starts empty when archnaut.json does not exist", async () => {
    const dir = await makeTempDir();
    const jsonPath = path.join(dir, "archnaut.json");
    const store = await createStore(jsonPath, { dbPath: ":memory:" });

    expect(store.getArchJsonPath()).toBe(jsonPath);
    const db = store.getDb();
    for (const table of EMPTY_GRAPH_TABLES) {
      expect(tableCount(db, table)).toBe(0);
    }
    expect((db.prepare("SELECT COUNT(*) AS c FROM project").get() as { c: number }).c).toBe(1);

    const snapshot = getArchitectureSnapshot(db);
    expect(snapshot.project.id).toMatch(/^repo\./);
    expect(snapshot.nodes).toHaveLength(0);

    store.close();
  });

  it("rejects a second store on the same db path", async () => {
    const dir = await makeTempDir();
    const jsonPath = path.join(dir, "archnaut.json");
    const dbPath = path.join(dir, ".archnaut", "db.sqlite");
    const store1 = await createStore(jsonPath, { dbPath });
    await expect(createStore(jsonPath, { dbPath })).rejects.toThrow(SingleStoreError);
    store1.close();
  });

  it("releases store lock on close so the same db path can reopen", async () => {
    const dir = await makeTempDir();
    const jsonPath = path.join(dir, "archnaut.json");
    const dbPath = path.join(dir, ".archnaut", "db.sqlite");
    const lockPath = path.join(dir, ".archnaut", "store.lock");

    const store1 = await createStore(jsonPath, { dbPath });
    await expect(access(lockPath)).resolves.toBeUndefined();

    store1.close();

    await expect(access(lockPath)).rejects.toThrow();

    const store2 = await createStore(jsonPath, { dbPath });
    store2.close();
  });
});
