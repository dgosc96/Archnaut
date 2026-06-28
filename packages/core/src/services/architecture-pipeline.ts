import type Database from "better-sqlite3";

import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import { loadArchnautFile } from "../repository/load.js";
import { saveArchnautFile } from "../repository/save.js";
import { initDbFromFile } from "../db/init-from-file.js";
import { getArchitectureSnapshot } from "../db/queries.js";

let mutationChain: Promise<void> = Promise.resolve();

function withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(fn, fn);
  mutationChain = next.then(() => undefined, () => undefined);
  return next;
}

/**
 * Load, validate, and normalize `archnaut.json` in one step.
 *
 * @param path - Path to the canonical `archnaut.json` file.
 * @returns Normalized architecture document with deterministic sort order.
 * @throws When the file does not exist (`ArchnautFileNotFoundError`).
 * @throws When the file contents are not valid JSON (`ArchnautParseError`).
 * @throws When validation fails (`ArchnautValidationError`).
 * @remarks
 * Equivalent to `loadArchnautFile(path, { validate: true, normalize: false })` followed by
 * `normalizeArchnautFile`. Does not write to disk or mutate SQLite.
 */
export async function loadValidateNormalize(path: string): Promise<ArchnautFileV1> {
  const file = await loadArchnautFile(path, { validate: true, normalize: false });
  return normalizeArchnautFile(file);
}

/**
 * Normalize, persist `archnaut.json`, and optionally refresh the SQLite runtime projection.
 *
 * @param path - Target path for the canonical architecture file.
 * @param file - In-memory document to persist.
 * @param db - Optional open `better-sqlite3` handle; when provided, the runtime DB is rebuilt.
 * @throws When the atomic file write fails (`ArchnautWriteError`).
 * @remarks
 * Normalizes once, writes atomically via {@link saveArchnautFile}, then — when `db` is supplied —
 * clears and repopulates the SQLite projection via `initDbFromFile`. The JSON file is the
 * git-tracked source of truth; the DB is a disposable runtime cache.
 */
export async function persistArchitecture(
  path: string,
  file: ArchnautFileV1,
  db?: Database.Database,
): Promise<void> {
  const normalized = normalizeArchnautFile(file);
  await saveArchnautFile(path, normalized, { normalize: false });
  if (db) {
    initDbFromFile(normalized, db);
  }
}

/**
 * Apply a synchronous DB mutation and persist the result to `archnaut.json`.
 *
 * @param path - Target path for the canonical architecture file.
 * @param db - Open better-sqlite3 handle for the runtime projection.
 * @param mutate - Synchronous function that mutates the SQLite projection in-place.
 * @returns Resolves when the mutation and persist complete successfully.
 * @throws When `mutate` throws; rolls back the DB to the pre-mutation snapshot.
 * @throws When persistence fails; rolls back the DB to the pre-mutation snapshot and
 *   attempts a best-effort file restore (original error is always re-thrown).
 */
export async function applyArchitectureMutation(
  path: string,
  db: Database.Database,
  mutate: () => void,
): Promise<void> {
  return withMutationLock(async () => {
    const before = getArchitectureSnapshot(db);
    try {
      mutate();
    } catch (error) {
      initDbFromFile(before, db);
      throw error;
    }
    const after = getArchitectureSnapshot(db);
    try {
      await persistArchitecture(path, after, db);
    } catch (error) {
      try {
        initDbFromFile(before, db);
      } catch {
        // best-effort DB rollback; original error takes precedence
      }
      try {
        await saveArchnautFile(path, before, { normalize: false });
      } catch {
        // best-effort file rollback; original error takes precedence
      }
      throw error;
    }
  });
}
