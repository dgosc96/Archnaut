import type { EdgeType } from "../schema/enums.js";
import { edgeTypeSchema } from "../validation/schemas/enums.schema.js";
import { EDGE_ID_PATTERN } from "./patterns.js";

const EDGE_TYPES: EdgeType[] = [...edgeTypeSchema.options].sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);

/** Structured breakdown of an edge ID (`edge.<slug>` or `edge.<slug>-<type>`). */
export interface ParsedEdgeId {
  /** Body slug between `edge.` and an optional trailing edge-type suffix. */
  slug: string;
  /** Trailing edge type when present on generated IDs; omitted for legacy hand-authored IDs. */
  type?: EdgeType;
  /** Original ID string passed to the parser. */
  raw: string;
}

/**
 * Parse an edge ID into its slug and optional type suffix.
 *
 * Generated IDs end with `-<type>` (e.g. `edge.api.checkout-stripe-calls`). Legacy IDs
 * without a type suffix still parse with `type` omitted.
 *
 * @param id - Edge ID to parse.
 * @returns Parsed structure, or `null` when the ID does not match the edge pattern.
 */
export function parseEdgeId(id: string): ParsedEdgeId | null {
  if (!EDGE_ID_PATTERN.test(id)) {
    return null;
  }

  const body = id.slice(5);
  for (const type of EDGE_TYPES) {
    const suffix = `-${type}`;
    if (body.endsWith(suffix)) {
      return {
        slug: body.slice(0, -suffix.length),
        type,
        raw: id,
      };
    }
  }

  return { slug: body, raw: id };
}
