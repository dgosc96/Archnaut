import type { EdgeStatus, EdgeType } from "./enums.js";

/** Optional extensible metadata on an edge (description plus arbitrary keys). */
export interface EdgeMetadata {
  /** Human-readable description of the relationship. */
  description?: string;
  [key: string]: unknown;
}

/** A directed relationship between two nodes in the architecture graph. */
export interface Edge {
  /** Semantic stable identifier. Form: `edge.<fromTail>-<toTail>-<type>`. */
  id: string;
  /** Source node ID. */
  from: string;
  /** Target node ID. */
  to: string;
  /** Semantic relationship type. */
  type: EdgeType;
  /** Whether the edge is design-only or backed by implemented code paths. */
  status: EdgeStatus;
  /** Optional descriptive metadata and extension fields. */
  metadata?: EdgeMetadata;
}
