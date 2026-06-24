import type { LayoutEntry, Meta } from "../schema/meta.js";
import { dedupeSorted } from "./sort.js";

/**
 * Normalize `meta`: stamp `lastNormalizedAt`, prune orphan layout keys, default `schemaVersion`.
 *
 * @param meta - Raw meta block from the architecture file.
 * @param validNodeIds - Node ids present after normalization (for layout pruning).
 * @returns Normalized meta with updated timestamps.
 */
export function normalizeMeta(
  meta: Meta,
  validNodeIds: Set<string>,
): Meta {
  const normalized: Meta = {
    schemaVersion: meta.schemaVersion ?? "1.0.0",
    lastNormalizedAt: new Date().toISOString(),
  };

  if (meta.createdBy !== undefined) {
    normalized.createdBy = meta.createdBy;
  }

  if (meta.hookPolicy !== undefined) {
    normalized.hookPolicy = meta.hookPolicy;
  }

  if (meta.layout && Object.keys(meta.layout).length > 0) {
    const layout: Record<string, LayoutEntry> = {};
    const keys = Object.keys(meta.layout).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      if (validNodeIds.has(key)) {
        layout[key] = meta.layout[key]!;
      }
    }
    if (Object.keys(layout).length > 0) {
      normalized.layout = layout;
    }
  }

  return normalized;
}

/**
 * Dedupe and sort workspace tags; returns `undefined` when empty.
 *
 * @param tags - Optional tag list from a workspace.
 * @returns Sorted unique tags, or `undefined` when absent/empty.
 */
export function normalizeWorkspaceTags(tags: string[] | undefined): string[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }
  return dedupeSorted(tags);
}
