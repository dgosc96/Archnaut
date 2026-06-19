import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { normalizeArchnautFile } from "../../src/normalize/normalize-archnaut-file.js";
import { serializeArchnautFile } from "../../src/normalize/serialize.js";
import {
  ArchnautFileNotFoundError,
  ArchnautValidationError,
} from "../../src/repository/errors.js";
import { loadArchnautFile } from "../../src/repository/load.js";
import { saveArchnautFile, getTempPathFor } from "../../src/repository/save.js";
import { createArchnautRepository } from "../../src/repository/archnaut-repository.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "archnaut-core-"));
  tempDirs.push(dir);
  return dir;
}

describe("repository", () => {
  it("load throws when file is missing", async () => {
    const dir = await makeTempDir();
    await expect(loadArchnautFile(path.join(dir, "missing.json"))).rejects.toBeInstanceOf(
      ArchnautFileNotFoundError,
    );
  });

  it("save writes atomically via temp file", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    const normalized = normalizeArchnautFile(shopPlatformFixture);
    await saveArchnautFile(filePath, normalized, { normalize: false });

    const content = await readFile(filePath, "utf8");
    expect(content).toBe(serializeArchnautFile(normalized));
    expect(getTempPathFor(filePath)).toContain(".tmp");
  });

  it("load validates by default", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    const invalid = JSON.stringify({ version: 1, project: {}, workspaces: [], nodes: [], edges: [], concerns: [], meta: {} });
    await import("node:fs/promises").then((fs) => fs.writeFile(filePath, invalid, "utf8"));

    await expect(loadArchnautFile(filePath)).rejects.toBeInstanceOf(ArchnautValidationError);
  });

  it("repository exists() reflects file presence", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "archnaut.json");
    const repo = createArchnautRepository({ filePath });
    expect(await repo.exists()).toBe(false);
    await saveArchnautFile(filePath, shopPlatformFixture);
    expect(await repo.exists()).toBe(true);
    const loaded = await repo.load();
    expect(loaded.project.id).toBe(shopPlatformFixture.project.id);
  });
});
