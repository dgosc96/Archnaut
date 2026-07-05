import { access, mkdir } from "node:fs/promises";
import { statSync, unlinkSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import {
  createBootstrapArchitecture,
  migrateDb,
  initDbFromFile,
  loadValidateNormalize,
} from "@archnaut/core";
import lockfile from "proper-lockfile";

const STORE_LOCK_STALE_MS = 10_000;
const STORE_LOCK_UPDATE_MS = 5_000;

/**
 * Thrown when another process already holds the exclusive store lock for this project.
 */
export class SingleStoreError extends Error {
  /**
   * @param lockPath - Path to the exclusive `.archnaut/store.lock` file already held.
   */
  constructor(lockPath: string) {
    super(
      `Another Archnaut server already owns this project store (${lockPath}). Only one process per database is supported.`,
    );
    this.name = "SingleStoreError";
  }
}

/**
 * Runtime access to the SQLite projection and canonical `archnaut.json` path.
 * Obtained from {@link createStore}; callers pass this into HTTP/MCP handlers.
 */
export interface Store {
  /** Open better-sqlite3 handle for the runtime projection under `.archnaut/db.sqlite`. */
  getDb(): Database.Database;
  /** Absolute path to the project's git-tracked `archnaut.json`. */
  getArchJsonPath(): string;
  /** Close the SQLite handle and release the on-disk store lock when held. */
  close(): void;
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

type StoreLock = { release: () => void; lockPath: string };

function migrateLegacyStoreLockFile(lockPath: string): void {
  try {
    if (statSync(lockPath).isFile()) {
      unlinkSync(lockPath);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Acquire an exclusive on-disk store lock for the given database path.
 *
 * @param dbPath - Absolute path to the SQLite database file.
 * @returns Lock handle, or `null` for in-memory stores.
 * @throws {@link SingleStoreError} when another live process holds the lock.
 */
function acquireStoreLock(dbPath: string): StoreLock | null {
  if (dbPath === ":memory:") {
    return null;
  }

  const lockPath = path.join(path.dirname(dbPath), "store.lock");
  migrateLegacyStoreLockFile(lockPath);

  try {
    const release = lockfile.lockSync("", {
      lockfilePath: lockPath,
      realpath: false,
      stale: STORE_LOCK_STALE_MS,
      update: STORE_LOCK_UPDATE_MS,
      retries: 0,
    });
    return { release, lockPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOCKED") {
      throw new SingleStoreError(lockPath);
    }
    throw error;
  }
}

/**
 * Release an on-disk store lock acquired by {@link acquireStoreLock}.
 *
 * @param lock - Lock handle returned from `acquireStoreLock`.
 */
function releaseStoreLock(lock: StoreLock): void {
  try {
    lock.release();
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "store lock release failed",
        lockPath: lock.lockPath,
        pid: process.pid,
        err:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "UnknownError", message: String(error) },
      }),
    );
  }
}

/**
 * Open the runtime store: migrate SQLite and hydrate from `archnaut.json` when present.
 *
 * @param archJsonPath - Absolute path to the project's canonical `archnaut.json`.
 * @param options - Optional overrides for the SQLite database location.
 * @returns Store handle for DB access and the canonical JSON path.
 * @throws When SQLite cannot be opened, schema migration fails, or existing `archnaut.json` fails validation.
 * @throws {@link SingleStoreError} when another process already owns the on-disk store lock.
 * @remarks
 * Ensures `.archnaut/` exists under the project root (unless `dbPath` is `':memory:'`) and opens
 * `db.sqlite` there by default. When `archnaut.json` is on disk, loads, validates, normalizes, and
 * projects it into SQLite; otherwise seeds a minimal bootstrap projection for the first scan.
 * Mutation serialization in `@archnaut/core` is process-local; on-disk stores acquire
 * `.archnaut/store.lock` so only one server process may open a given database.
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

  const lock = acquireStoreLock(dbPath);
  let db: Database.Database | undefined;

  try {
    db = new Database(dbPath);
    migrateDb(db);

    if (await archJsonExists(archJsonPath)) {
      const normalized = await loadValidateNormalize(archJsonPath);
      initDbFromFile(normalized, db);
    } else {
      initDbFromFile(createBootstrapArchitecture(projectRoot), db);
    }
  } catch (error) {
    try {
      db?.close();
    } finally {
      if (lock !== null) releaseStoreLock(lock);
    }
    throw error;
  }

  return {
    getDb: () => db,
    getArchJsonPath: () => archJsonPath,
    close: () => {
      db.close();
      if (lock !== null) {
        releaseStoreLock(lock);
      }
    },
  };
}
