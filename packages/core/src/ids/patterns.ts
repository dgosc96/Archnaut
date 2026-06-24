export const WORKSPACE_ID_PATTERN = /^ws\.[a-z0-9][a-z0-9.-]*$/;
export const NODE_ID_PREFIX_PATTERN = /^(cmp|pkg|db|ext|queue)\./;
export const EDGE_ID_PATTERN = /^edge\.[a-z0-9][a-z0-9._-]*$/;
export const CONCERN_ID_PATTERN = /^concern\.[a-z0-9][a-z0-9.-]*$/;

/**
 * Normalize a human label into a lowercase slug safe for semantic IDs.
 *
 * @param input - Raw label from UI or scan heuristics.
 * @returns Lowercase slug with unsafe characters removed.
 */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9.-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Return the segment after the final `.` in a dotted semantic id.
 *
 * @param id - Full semantic identifier.
 * @returns Tail segment used in edge id slugs.
 */
export function lastSegment(id: string): string {
  const parts = id.split(".");
  return parts[parts.length - 1] ?? id;
}
