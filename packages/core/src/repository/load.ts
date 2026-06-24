import { readFile } from "node:fs/promises";

import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { validateArchnautFile } from "../validation/validate-archnaut-file.js";
import { normalizeArchnautFile } from "../normalize/normalize-archnaut-file.js";
import {
  ArchnautFileNotFoundError,
  ArchnautParseError,
  ArchnautValidationError,
} from "./errors.js";

/** Options for {@link loadArchnautFile}. */
export interface LoadArchnautFileOptions {
  /** When `true` (default), run full validation and throw on failure. */
  validate?: boolean;
  /** When `true`, return a normalized copy after successful validation. Default `false`. */
  normalize?: boolean;
}

/**
 * Read and optionally validate `archnaut.json` from disk.
 *
 * @param path - Path to the canonical `archnaut.json` file.
 * @param options - Validation and normalization flags.
 * @returns Parsed architecture document; normalized when `options.normalize` is `true`.
 * @throws When the file does not exist (`ArchnautFileNotFoundError`, `ENOENT`).
 * @throws When the file contents are not valid JSON (`ArchnautParseError`).
 * @throws When validation is enabled and the document fails checks (`ArchnautValidationError`).
 * @throws When the underlying filesystem read fails for reasons other than a missing file.
 */
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
