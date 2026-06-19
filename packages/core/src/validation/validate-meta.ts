import { metaSchema, type Meta } from "./schemas/meta.schema.js";
import type { ValidationContext } from "./validation-context.js";
import type { ValidationResult } from "./issues.js";
import { validationFail, validationOk } from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";

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
