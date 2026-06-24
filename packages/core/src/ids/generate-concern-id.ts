import { normalizeSlug } from "./patterns.js";

/**
 * Assign a semantic concern ID from a display slug.
 *
 * @param slug - Concern label normalized into the `concern.<slug>` form.
 * @returns Concern ID (e.g. `concern.recommendations-source`).
 *
 * @example
 * generateConcernId("recommendations-source");
 * // "concern.recommendations-source"
 */
export function generateConcernId(slug: string): string {
  return `concern.${normalizeSlug(slug) || "item"}`;
}
