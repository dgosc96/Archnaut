import type { Edge } from "../schema/edge.js";

function isEmptyRecord(value: Record<string, unknown> | undefined): boolean {
  return !value || Object.keys(value).length === 0;
}

/**
 * Normalize a single edge — drops empty `metadata` objects.
 *
 * @param edge - Edge to normalize.
 * @returns Normalized edge suitable for persistence.
 */
export function normalizeEdge(edge: Edge): Edge {
  const normalized: Edge = {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    type: edge.type,
    status: edge.status,
  };

  if (edge.metadata && !isEmptyRecord(edge.metadata as Record<string, unknown>)) {
    normalized.metadata = edge.metadata;
  }

  return normalized;
}
