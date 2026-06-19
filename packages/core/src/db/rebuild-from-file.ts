import Database from "better-sqlite3";

import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import { loadArchnautFile } from "../repository/load.js";
import { initDbFromFile } from "./init-from-file.js";
import { migrateDb } from "./migrate.js";

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
