export interface Identifiable {
  id: string;
}

export function sortById<T extends Identifiable>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

export function sortStringArray(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function dedupeSorted(values: string[]): string[] {
  const sorted = sortStringArray(values);
  return sorted.filter((value, index) => index === 0 || value !== sorted[index - 1]);
}
