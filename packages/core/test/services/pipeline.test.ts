import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDb } from "../../src/db/migrate.js";
import { getArchitectureSnapshot } from "../../src/db/queries.js";
import {
  loadValidateNormalize,
  persistArchitecture,
} from "../../src/services/architecture-pipeline.js";
import { saveArchnautFile } from "../../src/repository/save.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "archnaut-pipeline-"));
  tempDirs.push(dir);
  return dir;
}

describe("architecture pipeline", () => {
  it("loadValidateNormalize loads and normalizes", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    await saveArchnautFile(filePath, shopPlatformFixture);

    const loaded = await loadValidateNormalize(filePath);
    expect(loaded.nodes.map((n) => n.id)).toEqual(
      [...shopPlatformFixture.nodes].sort((a, b) => a.id.localeCompare(b.id)).map((n) => n.id),
    );
  });

  it("persistArchitecture saves and hydrates db", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    const db = new Database(":memory:");
    migrateDb(db);

    await persistArchitecture(filePath, shopPlatformFixture, db);
    const snapshot = getArchitectureSnapshot(db);
    expect(snapshot.project.name).toBe("Shop Platform");
    db.close();
  });
});
