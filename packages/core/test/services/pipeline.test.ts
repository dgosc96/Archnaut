import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/db/init-from-file.js", async () => {
  const real = await vi.importActual<typeof import("../../src/db/init-from-file.js")>(
    "../../src/db/init-from-file.js",
  );
  return { initDbFromFile: vi.fn(real.initDbFromFile) };
});

import { initDbFromFile } from "../../src/db/init-from-file.js";
import { migrateDb } from "../../src/db/migrate.js";
import { getArchitectureSnapshot } from "../../src/db/queries.js";
import { upsertNode } from "../../src/db/mutations.js";
import {
  applyArchitectureMutation,
  loadValidateNormalize,
  persistArchitecture,
  readArchitectureSnapshot,
} from "../../src/services/architecture-pipeline.js";
import * as saveModule from "../../src/repository/save.js";
import { saveArchnautFile } from "../../src/repository/save.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.mocked(initDbFromFile).mockClear();
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

  it("applyArchitectureMutation rolls back DB when mutate throws", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    const db = new Database(":memory:");
    migrateDb(db);

    await persistArchitecture(filePath, shopPlatformFixture, db);
    const before = getArchitectureSnapshot(db);

    await expect(
      applyArchitectureMutation(filePath, db, () => {
        upsertNode(db, { id: "cmp.canary", name: "Canary", kind: "component", status: "planned", files: [] });
        throw new Error("mutate failed");
      }),
    ).rejects.toThrow("mutate failed");

    const after = getArchitectureSnapshot(db);
    expect(after).toEqual(before);
    db.close();
  });

  it("applyArchitectureMutation rolls back DB and file when initDbFromFile throws during persist", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    const db = new Database(":memory:");
    migrateDb(db);

    await persistArchitecture(filePath, shopPlatformFixture, db);
    const before = getArchitectureSnapshot(db);
    const jsonBefore = await readFile(filePath, "utf8");

    // First call (inside persistArchitecture) throws; rollback call uses real impl
    vi.mocked(initDbFromFile).mockImplementationOnce(() => {
      throw new Error("simulated DB init failure");
    });

    await expect(
      applyArchitectureMutation(filePath, db, () => {
        upsertNode(db, { id: "cmp.extra", name: "Extra", kind: "component", status: "planned", files: [] });
      }),
    ).rejects.toThrow("simulated DB init failure");

    expect(getArchitectureSnapshot(db)).toEqual(before);
    expect(await readFile(filePath, "utf8")).toBe(jsonBefore);
    db.close();
  });

  it("applyArchitectureMutation restores file when DB rollback also fails during persist cleanup", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    const db = new Database(":memory:");
    migrateDb(db);

    await persistArchitecture(filePath, shopPlatformFixture, db);
    const before = getArchitectureSnapshot(db);
    const jsonBefore = await readFile(filePath, "utf8");

    vi.mocked(initDbFromFile)
      .mockImplementationOnce(() => {
        throw new Error("simulated DB init failure");
      })
      .mockImplementationOnce(() => {
        throw new Error("simulated DB rollback failure");
      });

    await expect(
      applyArchitectureMutation(filePath, db, () => {
        upsertNode(db, { id: "cmp.extra", name: "Extra", kind: "component", status: "planned", files: [] });
      }),
    ).rejects.toThrow("simulated DB init failure");

    expect(getArchitectureSnapshot(db)).not.toEqual(before);
    expect(await readFile(filePath, "utf8")).toBe(jsonBefore);
    db.close();
  });

  it("readArchitectureSnapshot waits for in-flight mutation and skips rolled-back state", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    const db = new Database(":memory:");
    migrateDb(db);

    await persistArchitecture(filePath, shopPlatformFixture, db);
    const before = getArchitectureSnapshot(db);

    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const saveSpy = vi.spyOn(saveModule, "saveArchnautFile");
    saveSpy.mockImplementation(async (...args) => {
      await saveGate;
      saveSpy.mockRestore();
      return saveArchnautFile(...args);
    });

    vi.mocked(initDbFromFile).mockImplementationOnce(() => {
      throw new Error("simulated DB init failure");
    });

    const mutation = applyArchitectureMutation(filePath, db, () => {
      upsertNode(db, { id: "cmp.extra", name: "Extra", kind: "component", status: "planned", files: [] });
    });

    await vi.waitFor(() => {
      expect(getArchitectureSnapshot(db).nodes.some((n) => n.id === "cmp.extra")).toBe(true);
    });

    let readResolved = false;
    const readPromise = readArchitectureSnapshot(db).then((snapshot) => {
      readResolved = true;
      return snapshot;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(readResolved).toBe(false);

    releaseSave();

    await expect(mutation).rejects.toThrow("simulated DB init failure");

    const snapshot = await readPromise;
    expect(snapshot).toEqual(before);
    db.close();
  });
});
