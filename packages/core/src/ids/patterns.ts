export const WORKSPACE_ID_PATTERN = /^ws\.[a-z0-9][a-z0-9.-]*$/;
export const NODE_ID_PREFIX_PATTERN = /^(cmp|pkg|db|ext|queue)\./;
export const EDGE_ID_PATTERN = /^edge\.[a-z0-9][a-z0-9._-]*$/;
export const CONCERN_ID_PATTERN = /^concern\.[a-z0-9][a-z0-9.-]*$/;

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9.-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function lastSegment(id: string): string {
  const parts = id.split(".");
  return parts[parts.length - 1] ?? id;
}
