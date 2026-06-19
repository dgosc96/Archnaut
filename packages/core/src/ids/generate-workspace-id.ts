import { normalizeSlug } from "./patterns.js";

export function generateWorkspaceId(name: string): string {
  const slug = normalizeSlug(name);
  return `ws.${slug || "workspace"}`;
}
