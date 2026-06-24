import { normalizeSlug } from "./patterns.js";
import { parseNodeId } from "./parse-node-id.js";

/**
 * Derive the endpoint tail used inside edge IDs from a node ID.
 *
 * For `cmp`/`pkg` nodes, returns `{workspace}.{name}` (e.g. `api.checkout` from
 * `cmp.api.checkout`). For `db`/`ext`/`queue`, returns the name segment only. Falls back
 * to a normalized slug when the node ID cannot be parsed.
 *
 * @param nodeId - Source node ID.
 * @returns Endpoint slug joined into edge IDs by {@link generateEdgeId}.
 */
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
