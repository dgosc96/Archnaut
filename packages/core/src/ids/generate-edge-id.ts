import type { EdgeType } from "../validation/schemas/enums.schema.js";
import { endpointSlug } from "./endpoint-slug.js";

export function generateEdgeId(
  fromId: string,
  toId: string,
  type: EdgeType,
): string {
  const fromTail = endpointSlug(fromId);
  const toTail = endpointSlug(toId);
  return `edge.${fromTail}-${toTail}-${type}`;
}
