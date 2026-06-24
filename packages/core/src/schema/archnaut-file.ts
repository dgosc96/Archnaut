import type { Concern } from "./concern.js";
import type { Edge } from "./edge.js";
import type { Meta } from "./meta.js";
import type { Node } from "./node.js";
import type { Project } from "./project.js";
import type { Workspace } from "./workspace.js";

/** Supported `archnaut.json` document version (literal `1` only in v0.1). */
export const ARCHNAUT_FILE_VERSION = 1 as const;

/** Top-level shape of the canonical git-tracked `archnaut.json` artifact (v1). */
export interface ArchnautFileV1 {
  /** Document version; must be the literal `1`. */
  version: typeof ARCHNAUT_FILE_VERSION;
  /** Repository-level metadata. */
  project: Project;
  /** Monorepo workspaces, apps, packages, or services. */
  workspaces: Workspace[];
  /** Components, databases, queues, and external services. */
  nodes: Node[];
  /** Dependency and call relationships between nodes. */
  edges: Edge[];
  /** Architectural concerns flagged for review. */
  concerns: Concern[];
  /** Bookkeeping, layout positions, and hook policy. */
  meta: Meta;
}
