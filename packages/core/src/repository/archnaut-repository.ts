import { access } from "node:fs/promises";

import type { ArchnautFileV1 } from "../validation/schemas/archnaut-file.schema.js";
import { loadArchnautFile } from "./load.js";
import { saveArchnautFile } from "./save.js";

export interface ArchnautRepositoryOptions {
  filePath: string;
  validateOnLoad?: boolean;
  normalizeOnSave?: boolean;
}

export interface ArchnautRepository {
  load(): Promise<ArchnautFileV1>;
  save(file: ArchnautFileV1): Promise<void>;
  exists(): Promise<boolean>;
}

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
