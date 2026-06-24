import type { ConcernSeverity, ConcernSource, ConcernStatus } from "./enums.js";

/** An architectural concern flagged for human or agent review. */
export interface Concern {
  /** Semantic stable identifier. Prefix: `concern.` (e.g. `concern.recommendations-source`). */
  id: string;
  /** Entity or scope the concern applies to (node id, workspace id, edge id, or free text). */
  scope: string;
  /** Severity for prioritization in the UI and agent workflows. */
  severity: ConcernSeverity;
  /** Whether the concern is still open or has been resolved. */
  status: ConcernStatus;
  /** Who raised the concern — an agent during a task or a human reviewer. */
  source: ConcernSource;
  /** Human-readable description of the concern. */
  description: string;
}
