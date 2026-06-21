import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getArchitectureSnapshot, saveArchnautFile } from "@archnaut/core";
import { afterEach, describe, expect, it } from "vitest";

import { createStore } from "../src/store.js";
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

    store.getDb().close();
  });

  it("starts empty when archnaut.json does not exist", async () => {
    const dir = await makeTempDir();
    const jsonPath = path.join(dir, "archnaut.json");
    const store = await createStore(jsonPath, { dbPath: ":memory:" });

    expect(store.getArchJsonPath()).toBe(jsonPath);
    const nodeCount = store
      .getDb()
      .prepare("SELECT COUNT(*) AS c FROM nodes")
      .get() as { c: number };
    expect(nodeCount.c).toBe(0);
    expect(store.getDb().prepare("SELECT id FROM project LIMIT 1").get()).toBeUndefined();

    store.getDb().close();
  });
});
