import type { EdgeType } from "../schema/enums.js";
import { endpointSlug } from "./endpoint-slug.js";

/**
 * Assign a semantic edge ID from two node IDs and a relationship type.
 *
 * Pure function of `(fromId, toId, type)` — repeatable across runs with no insertion-order suffixes.
 *
 * @param fromId - Source node ID.
 * @param toId - Target node ID.
 * @param type - Edge relationship type appended as the trailing suffix.
 * @returns Edge ID in the form `edge.<fromTail>-<toTail>-<type>`.
 *
 * @example
 * generateEdgeId("cmp.api.checkout", "ext.stripe", "calls");
 * // "edge.api.checkout-stripe-calls"
 */
export function generateEdgeId(
  fromId: string,
  toId: string,
  type: EdgeType,
): string {
  const fromTail = endpointSlug(fromId);
  const toTail = endpointSlug(toId);
  return `edge.${fromTail}-${toTail}-${type}`;
}
