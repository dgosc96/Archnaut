export interface Identifiable {
  id: string;
}

/**
 * Lexicographic order by UTF-16 code unit — locale-independent, stable across runtimes.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns `-1`, `0`, or `1` for sort callbacks.
 */
export function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Return a copy of `items` sorted by `id` ascending (code-unit order).
 *
 * @param items - Entities with an `id` field.
 * @returns New array sorted by `id`.
 */
export function sortById<T extends Identifiable>(items: T[]): T[] {
  return [...items].sort((a, b) => compareStrings(a.id, b.id));
}

/**
 * Return a copy of `values` sorted ascending (code-unit order).
 *
 * @param values - Strings to sort.
 * @returns New sorted array.
 */
export function sortStringArray(values: string[]): string[] {
  return [...values].sort(compareStrings);
}

/**
 * Sort strings and remove adjacent duplicates (input need not be pre-sorted).
 *
 * @param values - Strings to sort and dedupe.
 * @returns Sorted array with consecutive duplicates removed.
 */
export function dedupeSorted(values: string[]): string[] {
  const sorted = sortStringArray(values);
  return sorted.filter((value, index) => index === 0 || value !== sorted[index - 1]);
}
