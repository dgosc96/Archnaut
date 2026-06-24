import type { NodeKind, WorkspaceKind } from "../schema/enums.js";
import { normalizeSlug } from "./patterns.js";
import { parseWorkspaceId } from "./parse-workspace-id.js";

/** Inputs for assigning a new semantic node ID. */
export interface GenerateNodeIdInput {
  /** Node kind determines the ID prefix (`cmp`/`pkg`, `db`, `ext`, or `queue`). */
  kind: NodeKind;
  /** Workspace ID for component nodes; workspace slug is extracted when parseable. */
  workspaceId?: string;
  /** When `package`, component nodes use the `pkg.` prefix instead of `cmp.`. */
  workspaceKind?: WorkspaceKind;
  /** Human-readable name normalized into the trailing slug segment. */
  slug: string;
}

/**
 * Assign a semantic node ID from kind, workspace context, and a display slug.
 *
 * @param input - Node kind, optional workspace, and slug to normalize.
 * @returns Canonical node ID (e.g. `cmp.api.checkout`, `ext.stripe`).
 *
 * @example
 * generateNodeId({
 *   kind: "component",
 *   workspaceId: "ws.api",
 *   workspaceKind: "app",
 *   slug: "Checkout",
 * }); // "cmp.api.checkout"
 *
 * @example
 * generateNodeId({ kind: "external", slug: "Stripe" }); // "ext.stripe"
 */
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
