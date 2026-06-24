import { normalizeSlug } from "./patterns.js";

/**
 * Assign a semantic workspace ID from a display name.
 *
 * @param name - Workspace name normalized into the `ws.<slug>` form.
 * @returns Workspace ID (e.g. `ws.api`).
 *
 * @example
 * generateWorkspaceId("api"); // "ws.api"
 */
export function generateWorkspaceId(name: string): string {
  const slug = normalizeSlug(name);
  return `ws.${slug || "workspace"}`;
}
