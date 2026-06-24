import Database from "better-sqlite3";

import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import { loadArchnautFile } from "../repository/load.js";
import { initDbFromFile } from "./init-from-file.js";
import { migrateDb } from "./migrate.js";

/**
 * One-shot recovery: load `archnaut.json`, normalize, and fully rehydrate a database file.
 *
 * @param archnautJsonPath - Path to the canonical `archnaut.json` on disk.
 * @param dbPath - Path to the SQLite file to create or overwrite.
 *
 * @remarks Opens the database, runs {@link migrateDb}, then {@link initDbFromFile} with the
 * loaded and normalized file. Existing DB contents are replaced entirely — this is a full
 * rebuild from the git-tracked JSON artifact, not a partial sync. Closes the connection when
 * finished.
 *
 * @throws When the JSON file cannot be read or parsed.
 */
export async function rebuildDbFromFile(
  archnautJsonPath: string,
  dbPath: string,
): Promise<void> {
  const file = await loadArchnautFile(archnautJsonPath);
  const normalized = normalizeArchnautFile(file);
  const db = new Database(dbPath);
  try {
    migrateDb(db);
    initDbFromFile(normalized, db);
  } finally {
    db.close();
  }
}
