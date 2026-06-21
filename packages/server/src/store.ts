import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";
import {
  migrateDb,
  clearDb,
  initDbFromFile,
  loadValidateNormalize,
} from "@archnaut/core";

export interface Store {
  getDb(): Database.Database;
  getArchJsonPath(): string;
}

export interface CreateStoreOptions {
  /** Default: `<projectRoot>/.archnaut/db.sqlite`. Tests should pass `':memory:'`. */
  dbPath?: string;
}

async function archJsonExists(archJsonPath: string): Promise<boolean> {
  try {
    await access(archJsonPath);
    return true;
  } catch {
    return false;
  }
}

export async function createStore(
  archJsonPath: string,
  options?: CreateStoreOptions,
): Promise<Store> {
  const projectRoot = path.dirname(archJsonPath);
  const dbPath =
    options?.dbPath ?? path.join(projectRoot, ".archnaut", "db.sqlite");

  if (dbPath !== ":memory:") {
    await mkdir(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  migrateDb(db);

  if (await archJsonExists(archJsonPath)) {
    const normalized = await loadValidateNormalize(archJsonPath);
    initDbFromFile(normalized, db);
  } else {
    clearDb(db);
  }

  return {
    getDb: () => db,
    getArchJsonPath: () => archJsonPath,
  };
}
