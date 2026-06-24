import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";
import {
  migrateDb,
  clearDb,
  initDbFromFile,
  loadValidateNormalize,
} from "@archnaut/core";

/** Runtime access to the SQLite projection and canonical `archnaut.json` path. */
export interface Store {
  /** Open better-sqlite3 handle for the runtime projection. */
  getDb(): Database.Database;
  /** Absolute path to the project's `archnaut.json`. */
  getArchJsonPath(): string;
}

/** Options for {@link createStore}. */
export interface CreateStoreOptions {
  /** Default: `<projectRoot>/.archnaut/db.sqlite`. Tests should pass `':memory:'`. */
  dbPath?: string;
}

/** Return whether `archJsonPath` exists on disk. */
async function archJsonExists(archJsonPath: string): Promise<boolean> {
  try {
    await access(archJsonPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the runtime store: migrate SQLite and hydrate from `archnaut.json` when present.
 */
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
