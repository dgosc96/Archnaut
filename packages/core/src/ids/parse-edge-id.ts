import type { EdgeType } from "../validation/schemas/enums.schema.js";
import { EDGE_ID_PATTERN } from "./patterns.js";

const EDGE_TYPES: EdgeType[] = [
  "reads_writes",
  "depends_on",
  "subscribes",
  "publishes",
  "calls",
  "owns",
];

export interface ParsedEdgeId {
  slug: string;
  type?: EdgeType;
  raw: string;
}

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
