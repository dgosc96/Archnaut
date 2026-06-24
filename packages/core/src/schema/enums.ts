/** Package manager used at the repository root. */
export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

/** Classification of a workspace within a monorepo or single-package repository. */
export type WorkspaceKind = "app" | "package" | "service" | "library";

/** Kind of node in the architecture graph. */
export type NodeKind = "component" | "database" | "queue" | "external";

/** Whether a node exists only in the diagram or is reflected in the codebase. */
export type NodeStatus = "planned" | "implemented";

/** Architectural layer hint for a node (optional). */
export type NodeLayer = "frontend" | "backend" | "infrastructure";

/** Semantic relationship between two nodes. */
export type EdgeType =
  | "depends_on"
  | "calls"
  | "reads_writes"
  | "publishes"
  | "subscribes"
  | "owns";

/** Whether an edge is design-only or backed by implemented code paths. */
export type EdgeStatus = "planned" | "implemented";

/** Severity of an architectural concern flagged for review. */
export type ConcernSeverity = "low" | "medium" | "high";

/** Whether a concern is still open or has been resolved. */
export type ConcernStatus = "open" | "resolved";

/** Who raised the concern — an agent during a task or a human reviewer. */
export type ConcernSource = "agent" | "human";

/** Pre-commit hook behavior when the Archnaut daemon is not running. */
export type HookPolicy = "warn-on-daemon-down" | "block-on-daemon-down";
