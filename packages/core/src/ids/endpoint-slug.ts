import { lastSegment, normalizeSlug } from "./patterns.js";
import { parseNodeId } from "./parse-node-id.js";

export function endpointSlug(nodeId: string): string {
  const parsed = parseNodeId(nodeId);
  if (!parsed) {
    return normalizeSlug(lastSegment(nodeId));
  }
  if (parsed.workspaceSlug !== undefined) {
    return `${parsed.workspaceSlug}.${parsed.name}`;
  }
  return parsed.name;
}
