import type { NodeKind, NodeLayer, NodeStatus } from "./enums.js";

/** Optional extensible metadata on a node (description plus arbitrary keys). */
export interface NodeMetadata {
  /** Human-readable description of the node's role or planned behavior. */
  description?: string;
  [key: string]: unknown;
}

/** A node in the architecture graph (component, database, queue, or external). */
export interface Node {
  /** Semantic stable identifier assigned by the MCP server. Prefixes: `cmp.`, `pkg.`, `db.`, `ext.`, `queue.`. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Workspace this node belongs to; required for components, forbidden for `db`/`ext`/`queue`. */
  workspaceId?: string;
  /** Classification of this node. */
  kind: NodeKind;
  /** Whether the node is design-only or implemented in the codebase. */
  status: NodeStatus;
  /** Repository-relative file paths associated with this node. */
  files: string[];
  /** Optional tags for filtering; deduped and sorted on normalization. */
  tags?: string[];
  /** Optional technology stack hints (e.g. `react`, `postgres`). */
  tech?: string[];
  /** Optional architectural layer hint. */
  layer?: NodeLayer;
  /** Optional descriptive metadata and extension fields. */
  metadata?: NodeMetadata;
}
