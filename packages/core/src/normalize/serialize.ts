import type { ArchnautFileV1 } from "../validation/schemas/archnaut-file.schema.js";

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortObjectKeys(record[key]);
    }
    return sorted;
  }
  return value;
}

export function serializeArchnautFile(file: ArchnautFileV1): string {
  const sorted = sortObjectKeys(file);
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
