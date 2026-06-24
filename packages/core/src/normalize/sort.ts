export interface Identifiable {
  id: string;
}

/**
 * Return a copy of `items` sorted by `id` ascending (`localeCompare`).
 *
 * @param items - Entities with an `id` field.
 * @returns New array sorted by `id`.
 */
export function sortById<T extends Identifiable>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Return a copy of `values` sorted ascending (`localeCompare`).
 *
 * @param values - Strings to sort.
 * @returns New sorted array.
 */
export function sortStringArray(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
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
