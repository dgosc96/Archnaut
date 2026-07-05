import { compareStrings } from "../normalize/sort.js";

/**
 * Recursively sort object keys in lexicographic (code-unit) order.
 *
 * @param value - JSON-compatible value to normalize.
 * @returns Copy with all object keys sorted; array element order is preserved.
 */
export function sortObjectKeys(value: unknown): unknown {
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
 * Compare two JSON-compatible values for deep equality, ignoring object key order.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns `true` when values are structurally equal after key normalization.
 */
export function stableJsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortObjectKeys(a)) === JSON.stringify(sortObjectKeys(b));
}
