import { normalizeSlug } from "./patterns.js";

export function generateConcernId(slug: string): string {
  return `concern.${normalizeSlug(slug) || "item"}`;
}
