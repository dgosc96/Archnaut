import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { compareStrings } from "./sort.js";

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort(compareStrings)) {
      sorted[key] = sortObjectKeys(record[key]);
    }
    return sorted;
  }
  return value;
}

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
