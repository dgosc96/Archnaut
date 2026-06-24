/** Prefix segment for a node ID (`cmp`, `pkg`, `db`, `ext`, or `queue`). */
export type NodeIdPrefix = "cmp" | "pkg" | "db" | "ext" | "queue";

/** Structured breakdown of a semantic node ID. */
export interface ParsedNodeId {
  /** Leading kind prefix from the ID. */
  kindPrefix: NodeIdPrefix;
  /** Workspace slug for `cmp`/`pkg` nodes; omitted for `db`/`ext`/`queue`. */
  workspaceSlug?: string;
  /** Name segment after the workspace (or after the prefix for non-component kinds). */
  name: string;
  /** Original ID string passed to the parser. */
  raw: string;
}

const PREFIXES: NodeIdPrefix[] = ["cmp", "pkg", "db", "ext", "queue"];

/**
 * Parse a dot-separated node ID into its semantic parts.
 *
 * @param id - Node ID to parse (e.g. `cmp.api.checkout`, `ext.stripe`).
 * @returns Parsed structure, or `null` when the ID is missing a valid prefix or required segments.
 */
export function parseNodeId(id: string): ParsedNodeId | null {
  const parts = id.split(".");
  if (parts.length < 2) {
    return null;
  }

  const kindPrefix = parts[0] as NodeIdPrefix;
  if (!PREFIXES.includes(kindPrefix)) {
    return null;
  }

  if (kindPrefix === "cmp" || kindPrefix === "pkg") {
    if (parts.length < 3) {
      return null;
    }
    return {
      kindPrefix,
      workspaceSlug: parts[1],
      name: parts.slice(2).join("."),
      raw: id,
    };
  }

  return {
    kindPrefix,
    name: parts.slice(1).join("."),
    raw: id,
  };
}
