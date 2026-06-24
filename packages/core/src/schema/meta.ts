import type { HookPolicy } from "./enums.js";

/** Diagram canvas position for a node in the web UI. */
export interface LayoutEntry {
  /** Horizontal position in diagram coordinates. */
  x: number;
  /** Vertical position in diagram coordinates. */
  y: number;
}

/** Bookkeeping and UI metadata stored alongside the architecture graph. */
export interface Meta {
  /** Optional schema or tooling version string for forward compatibility. */
  schemaVersion?: string;
  /** Tool or agent that created or last materially changed the file. */
  createdBy?: string;
  /** ISO-8601 timestamp set on every normalization pass. */
  lastNormalizedAt?: string;
  /** Persisted React Flow node positions keyed by node id. */
  layout?: Record<string, LayoutEntry>;
  /** Pre-commit hook behavior when the Archnaut daemon is not running. */
  hookPolicy?: HookPolicy;
}
