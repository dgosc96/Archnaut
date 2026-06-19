import type { NodeKind } from "../validation/schemas/enums.schema.js";
import type { WorkspaceKind } from "../validation/schemas/enums.schema.js";
import { normalizeSlug } from "./patterns.js";
import { parseWorkspaceId } from "./parse-workspace-id.js";

export interface GenerateNodeIdInput {
  kind: NodeKind;
  workspaceId?: string;
  workspaceKind?: WorkspaceKind;
  slug: string;
}

export function generateNodeId(input: GenerateNodeIdInput): string {
  const name = normalizeSlug(input.slug) || "node";

  switch (input.kind) {
    case "database":
      return `db.${name}`;
    case "queue":
      return `queue.${name}`;
    case "external":
      return `ext.${name}`;
    case "component": {
      const wsSlug = input.workspaceId
        ? (parseWorkspaceId(input.workspaceId)?.name ?? normalizeSlug(input.workspaceId))
        : "default";
      const prefix = input.workspaceKind === "package" ? "pkg" : "cmp";
      return `${prefix}.${wsSlug}.${name}`;
    }
    default: {
      const _exhaustive: never = input.kind;
      return _exhaustive;
    }
  }
}
