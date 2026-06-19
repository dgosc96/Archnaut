import type { Node } from "../validation/schemas/node.schema.js";
import { dedupeSorted } from "./sort.js";

function isEmptyRecord(value: Record<string, unknown> | undefined): boolean {
  return !value || Object.keys(value).length === 0;
}

export function normalizeNode(node: Node): Node {
  const normalized: Node = {
    id: node.id,
    name: node.name,
    kind: node.kind,
    status: node.status,
    files: dedupeSorted(node.files),
  };

  if (node.workspaceId !== undefined) {
    normalized.workspaceId = node.workspaceId;
  }

  if (node.tags && node.tags.length > 0) {
    normalized.tags = dedupeSorted(node.tags);
  }

  if (node.tech && node.tech.length > 0) {
    normalized.tech = dedupeSorted(node.tech);
  }

  if (node.layer !== undefined) {
    normalized.layer = node.layer;
  }

  if (node.metadata && !isEmptyRecord(node.metadata as Record<string, unknown>)) {
    normalized.metadata = node.metadata;
  }

  return normalized;
}
