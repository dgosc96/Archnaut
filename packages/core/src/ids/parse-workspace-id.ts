import { WORKSPACE_ID_PATTERN } from "./patterns.js";

/** Structured breakdown of a workspace ID (`ws.<name>`). */
export interface ParsedWorkspaceId {
  /** Workspace name slug after the `ws.` prefix. */
  name: string;
  /** Original ID string passed to the parser. */
  raw: string;
}

/**
 * Parse a workspace ID in the form `ws.<name>`.
 *
 * @param id - Workspace ID to parse (e.g. `ws.api`).
 * @returns Parsed structure, or `null` when the ID does not match the workspace pattern.
 */
export function parseWorkspaceId(id: string): ParsedWorkspaceId | null {
  if (!WORKSPACE_ID_PATTERN.test(id)) {
    return null;
  }
  const name = id.slice(3);
  if (!name) {
    return null;
  }
  return { name, raw: id };
}
