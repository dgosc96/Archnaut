import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArchnautFileV1 } from "../validation/schemas/archnaut-file.schema.js";
import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import { serializeArchnautFile } from "../normalize/serialize.js";
import { ArchnautWriteError } from "./errors.js";

export interface SaveArchnautFileOptions {
  normalize?: boolean;
}

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

export function getTempPathFor(filePath: string): string {
  return path.join(path.dirname(filePath), `${path.basename(filePath)}.tmp`);
}
