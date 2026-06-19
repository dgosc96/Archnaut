import { normalizeSlug } from "./patterns.js";
import { parseNodeId } from "./parse-node-id.js";

export function endpointSlug(nodeId: string): string {
  const parsed = parseNodeId(nodeId);
  if (!parsed) {
    const parts = nodeId.split(".");
    const tail = parts.length > 1 ? parts.slice(1).join(".") : parts[0];
    return normalizeSlug(tail);
  }
  if (parsed.workspaceSlug !== undefined) {
    return `${parsed.workspaceSlug}.${parsed.name}`;
  }
  return parsed.name;
}
