import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import { serializeArchnautFile } from "../normalize/serialize.js";
import { ArchnautWriteError } from "./errors.js";

/** Options for {@link saveArchnautFile}. */
export interface SaveArchnautFileOptions {
  /** When `true` (default), normalize before serializing for deterministic output. */
  normalize?: boolean;
}

/**
 * Serialize and atomically persist `archnaut.json` to disk.
 *
 * @param filePath - Target path for the canonical architecture file.
 * @param file - In-memory architecture document to write.
 * @param options - Normalization flag applied before serialization.
 * @throws When the temp write or rename step fails (`ArchnautWriteError`).
 * @remarks
 * Writes to `<filePath>.tmp` first, then renames into place so readers never see a partial file.
 */
export async function saveArchnautFile(
  filePath: string,
  file: ArchnautFileV1,
  options: SaveArchnautFileOptions = {},
): Promise<void> {
  const { normalize = true } = options;
  const normalized = normalize ? normalizeArchnautFile(file) : file;
  const content = serializeArchnautFile(normalized);
  const tempPath = `${filePath}.tmp`;

  try {
    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    throw new ArchnautWriteError(filePath, error);
  }
}

/**
 * Resolve the sibling temp path used during atomic saves.
 *
 * @param filePath - Target `archnaut.json` path.
 * @returns Path to the `.tmp` file written before rename.
 */
export function getTempPathFor(filePath: string): string {
  return path.join(path.dirname(filePath), `${path.basename(filePath)}.tmp`);
}
