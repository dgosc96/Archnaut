import type { Concern } from "../schema/concern.js";
import { concernSchema } from "./schemas/concern.schema.js";
import type { ValidationContext } from "./validation-context.js";
import type { ValidationResult } from "./issues.js";
import { validationFail, validationOk } from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";
import { checkIdFormat } from "./validation-context.js";
import { parseNodeId } from "../ids/parse-node-id.js";
import { parseWorkspaceId } from "../ids/parse-workspace-id.js";

/**
 * Validate a single concern (schema, ID format, and scope reference when scope looks like an entity id).
 *
 * @param value - Raw concern object.
 * @param ctx - Known workspace, node, and edge IDs from the parent file.
 * @param index - Zero-based index in the parent `concerns` array (used in issue paths).
 * @returns On success, `{ ok: true, value: Concern, warnings? }`; `INVALID_ID_FORMAT` is downgraded to warnings.
 */
export function validateConcern(
  value: unknown,
  ctx: ValidationContext,
  index: number,
): ValidationResult<Concern> {
  const result = concernSchema.safeParse(value);
  if (!result.success) {
    return validationFail(zodIssuesToValidationIssues(result.error));
  }

  const concern = result.data;
  const issues = checkIdFormat(concern.id, `/concerns/${index}/id`, "concern");

  const scopeLooksLikeId =
    parseNodeId(concern.scope) !== null ||
    parseWorkspaceId(concern.scope) !== null ||
    concern.scope.startsWith("edge.");

  if (
    scopeLooksLikeId &&
    !ctx.nodeIds.has(concern.scope) &&
    !ctx.workspaceIds.has(concern.scope) &&
    !ctx.edgeIds.has(concern.scope)
  ) {
    issues.push({
      code: "INVALID_ID_FORMAT",
      path: `/concerns/${index}/scope`,
      message: `scope ${JSON.stringify(concern.scope)} looks like an id but does not reference a known entity`,
    });
  }

  const errors = issues.filter((i) => i.code !== "INVALID_ID_FORMAT");
  const warnings = issues.filter((i) => i.code === "INVALID_ID_FORMAT");
  if (errors.length > 0) {
    return validationFail(errors);
  }
  return validationOk(concern, warnings.length > 0 ? warnings : undefined);
}
