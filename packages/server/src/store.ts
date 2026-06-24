import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";
import {
  migrateDb,
  clearDb,
  initDbFromFile,
  loadValidateNormalize,
} from "@archnaut/core";

/**
 * Runtime access to the SQLite projection and canonical `archnaut.json` path.
 * Obtained from {@link createStore}; callers pass this into HTTP/MCP handlers.
 */
export interface Store {
  /** Open better-sqlite3 handle for the runtime projection under `.archnaut/db.sqlite`. */
  getDb(): Database.Database;
  /** Absolute path to the project's git-tracked `archnaut.json`. */
  getArchJsonPath(): string;
}

/** Options for {@link createStore}. */
export interface CreateStoreOptions {
  /** Default: `<projectRoot>/.archnaut/db.sqlite`. Tests should pass `':memory:'`. */
  dbPath?: string;
}

/**
 * Return whether `archJsonPath` exists on disk.
 *
 * @param archJsonPath - Absolute path to `archnaut.json`.
 * @returns `true` when the file is accessible.
 */
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
 *
 * @param archJsonPath - Absolute path to the project's canonical `archnaut.json`.
 * @param options - Optional overrides for the SQLite database location.
 * @returns Store handle for DB access and the canonical JSON path.
 * @throws When SQLite cannot be opened, schema migration fails, or existing `archnaut.json` fails validation.
 * @remarks
 * Ensures `.archnaut/` exists under the project root (unless `dbPath` is `':memory:'`) and opens
 * `db.sqlite` there by default. When `archnaut.json` is on disk, loads, validates, normalizes, and
 * projects it into SQLite; otherwise clears the runtime DB for bootstrap before the first scan.
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
