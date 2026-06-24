import type { Meta } from "../schema/meta.js";
import { metaSchema } from "./schemas/meta.schema.js";
import type { ValidationContext } from "./validation-context.js";
import type { ValidationResult } from "./issues.js";
import { validationFail, validationOk } from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";

/**
 * Validate meta block (schema plus layout node references).
 *
 * @param value - Raw meta object.
 * @param ctx - Known node IDs used to detect orphan layout entries.
 * @returns On success, `{ ok: true, value: Meta, warnings? }`; unknown layout keys produce `ORPHAN_LAYOUT` warnings.
 */
export function validateMeta(
  value: unknown,
  ctx: ValidationContext,
): ValidationResult<Meta> {
  const result = metaSchema.safeParse(value);
  if (!result.success) {
    return validationFail(zodIssuesToValidationIssues(result.error));
  }

  const warnings = [];
  if (result.data.layout) {
    for (const nodeId of Object.keys(result.data.layout)) {
      if (!ctx.nodeIds.has(nodeId)) {
        warnings.push({
          code: "ORPHAN_LAYOUT" as const,
          path: `/meta/layout/${nodeId}`,
          message: `Layout entry references unknown node id ${JSON.stringify(nodeId)}`,
        });
      }
    }
  }

  return validationOk(result.data, warnings.length > 0 ? warnings : undefined);
}
