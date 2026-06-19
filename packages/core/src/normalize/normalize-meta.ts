import type { Meta } from "../validation/schemas/meta.schema.js";
import type { LayoutEntry } from "../validation/schemas/meta.schema.js";
import { dedupeSorted } from "./sort.js";

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

export function normalizeWorkspaceTags(tags: string[] | undefined): string[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }
  return dedupeSorted(tags);
}
