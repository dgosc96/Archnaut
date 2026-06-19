import { readFile } from "node:fs/promises";

import type { ArchnautFileV1 } from "../validation/schemas/archnaut-file.schema.js";
import { validateArchnautFile } from "../validation/validate-archnaut-file.js";
import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import {
  ArchnautFileNotFoundError,
  ArchnautParseError,
  ArchnautValidationError,
} from "./errors.js";

export interface LoadArchnautFileOptions {
  validate?: boolean;
  normalize?: boolean;
}

export async function loadArchnautFile(
  path: string,
  options: LoadArchnautFileOptions = {},
): Promise<ArchnautFileV1> {
  const { validate = true, normalize = false } = options;

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new ArchnautFileNotFoundError(path);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ArchnautParseError(path, error);
  }

  if (!validate) {
    return parsed as ArchnautFileV1;
  }

  const result = validateArchnautFile(parsed);
  if (!result.ok) {
    throw new ArchnautValidationError(path, result.issues);
  }

  return normalize ? normalizeArchnautFile(result.value) : result.value;
}
