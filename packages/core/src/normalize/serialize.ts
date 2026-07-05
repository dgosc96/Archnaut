import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { sortObjectKeys } from "../json/sort-object-keys.js";

/**
 * Serialize an architecture file to stable JSON text for git commits.
 *
 * @param file - Architecture document to serialize.
 * @returns Pretty-printed JSON with 2-space indent and trailing newline.
 * @remarks Recursively sorts all object keys in lexicographic (code-unit) order before
 * stringifying so key insertion order in memory does not affect the written output.
 */
export function serializeArchnautFile(file: ArchnautFileV1): string {
  const sorted = sortObjectKeys(file);
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
