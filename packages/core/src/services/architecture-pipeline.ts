import type Database from "better-sqlite3";
import path from "node:path";

import { createBootstrapArchitecture } from "../bootstrap/create-bootstrap-architecture.js";
import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import { loadArchnautFile } from "../repository/load.js";
import { saveArchnautFile } from "../repository/save.js";
import { EmptyArchitectureError } from "../db/errors.js";
import { clearDb } from "../db/migrate.js";
import { initDbFromFile } from "../db/init-from-file.js";
import {
  insertConcern,
  patchNode,
  upsertEdge,
  upsertNode,
  type InsertConcernInput,
  type PatchNodeInput,
  type UpsertEdgeInput,
  type UpsertNodeInput,
} from "../db/mutations.js";
import { getArchitectureSnapshot } from "../db/queries.js";

export type {
  InsertConcernInput,
  PatchNodeInput,
  UpsertEdgeInput,
  UpsertNodeInput,
} from "../db/mutations.js";

let mutationChain: Promise<void> = Promise.resolve();

function withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(fn, fn);
  mutationChain = next.then(() => undefined, () => undefined);
  return next;
}

function tryGetSnapshot(db: Database.Database): ArchnautFileV1 | null {
  try {
    return getArchitectureSnapshot(db);
  } catch (error) {
    if (error instanceof EmptyArchitectureError) {
      return null;
    }
    throw error;
  }
}

function ensureBootstrapProject(db: Database.Database, archPath: string): void {
  const row = db.prepare(`SELECT 1 FROM project LIMIT 1`).get();
  if (row !== undefined) {
    return;
  }
  const projectRoot = path.dirname(archPath);
  initDbFromFile(createBootstrapArchitecture(projectRoot), db);
}

function rollbackDb(db: Database.Database, before: ArchnautFileV1 | null): void {
  if (before === null) {
    clearDb(db);
    return;
  }
  initDbFromFile(before, db);
}

/**
 * Read the architecture snapshot under the same lock used by mutations.
 *
 * @param db - Open better-sqlite3 handle for the runtime projection.
 * @returns Committed architecture state; waits for in-flight mutations to finish.
 */
export function readArchitectureSnapshot(db: Database.Database): Promise<ArchnautFileV1> {
  return withMutationLock(async () => getArchitectureSnapshot(db));
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
    let before = tryGetSnapshot(db);
    if (before === null) {
      ensureBootstrapProject(db, path);
      before = getArchitectureSnapshot(db);
    }
    try {
      mutate();
    } catch (error) {
      rollbackDb(db, before);
      throw error;
    }
    const after = getArchitectureSnapshot(db);
    try {
      await persistArchitecture(path, after, db);
    } catch (error) {
      try {
        rollbackDb(db, before);
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

/**
 * Upsert a node and persist the result to `archnaut.json`.
 *
 * @param path - Target path for the canonical architecture file.
 * @param db - Open better-sqlite3 handle for the runtime projection.
 * @param input - Full node fields to upsert.
 * @returns Resolves when the mutation and persist complete successfully.
 * @throws When the upsert fails or persistence fails; rolls back per {@link applyArchitectureMutation}.
 */
export async function applyUpsertNode(
  path: string,
  db: Database.Database,
  input: UpsertNodeInput,
): Promise<void> {
  return applyArchitectureMutation(path, db, () => upsertNode(db, input));
}

/**
 * Upsert an edge and persist the result to `archnaut.json`.
 *
 * @param path - Target path for the canonical architecture file.
 * @param db - Open better-sqlite3 handle for the runtime projection.
 * @param input - Full edge fields to upsert.
 * @returns Resolves when the mutation and persist complete successfully.
 * @throws When the upsert fails or persistence fails; rolls back per {@link applyArchitectureMutation}.
 */
export async function applyUpsertEdge(
  path: string,
  db: Database.Database,
  input: UpsertEdgeInput,
): Promise<void> {
  return applyArchitectureMutation(path, db, () => upsertEdge(db, input));
}

/**
 * Patch an existing node and persist the result to `archnaut.json`.
 *
 * @param path - Target path for the canonical architecture file.
 * @param db - Open better-sqlite3 handle for the runtime projection.
 * @param input - Partial node fields to update.
 * @returns Resolves when the mutation and persist complete successfully.
 * @throws When the patch fails or persistence fails; rolls back per {@link applyArchitectureMutation}.
 */
export async function applyPatchNode(
  path: string,
  db: Database.Database,
  input: PatchNodeInput,
): Promise<void> {
  return applyArchitectureMutation(path, db, () => patchNode(db, input));
}

/**
 * Insert a concern and persist the result to `archnaut.json`.
 *
 * @param path - Target path for the canonical architecture file.
 * @param db - Open better-sqlite3 handle for the runtime projection.
 * @param input - Concern fields to insert.
 * @returns Resolves when the mutation and persist complete successfully.
 * @throws When the insert fails or persistence fails; rolls back per {@link applyArchitectureMutation}.
 */
export async function applyInsertConcern(
  path: string,
  db: Database.Database,
  input: InsertConcernInput,
): Promise<void> {
  return applyArchitectureMutation(path, db, () => insertConcern(db, input));
}
