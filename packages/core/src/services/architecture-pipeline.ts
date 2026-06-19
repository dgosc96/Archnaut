import type Database from "better-sqlite3";

import type { ArchnautFileV1 } from "../validation/schemas/archnaut-file.schema.js";
import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import { loadArchnautFile } from "../repository/load.js";
import { saveArchnautFile } from "../repository/save.js";
import { initDbFromFile } from "../db/init-from-file.js";

export async function loadValidateNormalize(path: string): Promise<ArchnautFileV1> {
  const file = await loadArchnautFile(path, { validate: true, normalize: false });
  return normalizeArchnautFile(file);
}

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
