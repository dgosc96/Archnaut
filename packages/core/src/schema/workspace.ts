import type { WorkspaceKind } from "./enums.js";

/** A workspace, app, package, or service within the repository. */
export interface Workspace {
  /** Semantic stable identifier assigned by the MCP server. Prefix: `ws.` (e.g. `ws.api`, `ws.web`). */
  id: string;
  /** Short workspace name (e.g. `api`, `web`, `shared`). */
  name: string;
  /** Path to the workspace root relative to the project root. */
  path: string;
  /** Classification of this workspace. */
  kind: WorkspaceKind;
  /** Optional tags for filtering or grouping; deduped and sorted on normalization. */
  tags?: string[];
}
