export type NodeIdPrefix = "cmp" | "pkg" | "db" | "ext" | "queue";

export interface ParsedNodeId {
  kindPrefix: NodeIdPrefix;
  workspaceSlug?: string;
  name: string;
  raw: string;
}

const PREFIXES: NodeIdPrefix[] = ["cmp", "pkg", "db", "ext", "queue"];

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
