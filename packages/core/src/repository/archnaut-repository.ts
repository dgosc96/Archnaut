import { access } from "node:fs/promises";

import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { loadArchnautFile } from "./load.js";
import { saveArchnautFile } from "./save.js";

/** Options for {@link createArchnautRepository}. */
export interface ArchnautRepositoryOptions {
  /** Absolute or relative path to the canonical `archnaut.json` file. */
  filePath: string;
  /** When `true` (default), validate on {@link ArchnautRepository.load}. */
  validateOnLoad?: boolean;
  /** When `true` (default), normalize on {@link ArchnautRepository.save}. */
  normalizeOnSave?: boolean;
}

/**
 * Filesystem facade for loading and saving the canonical architecture document.
 *
 * Obtained from {@link createArchnautRepository}; wraps {@link loadArchnautFile} and
 * {@link saveArchnautFile} with fixed path and default options.
 */
export interface ArchnautRepository {
  /**
   * Load and optionally validate `archnaut.json`.
   *
   * @throws When the file does not exist (`ArchnautFileNotFoundError`).
   * @throws When the file contents are not valid JSON (`ArchnautParseError`).
   * @throws When validation is enabled and the document fails checks (`ArchnautValidationError`).
   */
  load(): Promise<ArchnautFileV1>;
  /**
   * Persist an architecture document to the configured path.
   *
   * @param file - In-memory document to write.
   * @throws When the atomic write fails (`ArchnautWriteError`).
   * @remarks Delegates to {@link saveArchnautFile}; may normalize before serializing.
   */
  save(file: ArchnautFileV1): Promise<void>;
  /** Return whether `filePath` is accessible on disk (never throws). */
  exists(): Promise<boolean>;
}

/**
 * Create a repository bound to a single `archnaut.json` path.
 *
 * @param opts - File path and load/save behavior flags.
 * @returns Repository with {@link ArchnautRepository.load}, {@link ArchnautRepository.save},
 *   and {@link ArchnautRepository.exists} methods.
 */
export function createArchnautRepository(
  opts: ArchnautRepositoryOptions,
): ArchnautRepository {
  const validateOnLoad = opts.validateOnLoad ?? true;
  const normalizeOnSave = opts.normalizeOnSave ?? true;

  return {
    async load() {
      return loadArchnautFile(opts.filePath, { validate: validateOnLoad });
    },
    async save(file) {
      return saveArchnautFile(opts.filePath, file, { normalize: normalizeOnSave });
    },
    async exists() {
      try {
        await access(opts.filePath);
        return true;
      } catch {
        return false;
      }
    },
  };
}
