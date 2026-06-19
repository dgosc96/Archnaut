import { nodeSchema, type Node } from "./schemas/node.schema.js";
import type { ValidationContext } from "./validation-context.js";
import type { ValidationResult } from "./issues.js";
import { validationFail, validationOk } from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";
import { checkIdFormat } from "./validation-context.js";

export function validateNode(
  value: unknown,
  ctx: ValidationContext,
  index: number,
): ValidationResult<Node> {
  const result = nodeSchema.safeParse(value);
  if (!result.success) {
    return validationFail(zodIssuesToValidationIssues(result.error));
  }

  const node = result.data;
  const issues = checkIdFormat(node.id, `/nodes/${index}/id`, "node");

  if (node.workspaceId !== undefined && !ctx.workspaceIds.has(node.workspaceId)) {
    issues.push({
      code: "MISSING_REFERENCE",
      path: `/nodes/${index}/workspaceId`,
      message: `workspaceId ${JSON.stringify(node.workspaceId)} not found in workspaces`,
    });
  }

  if (
    (node.kind === "external" || node.kind === "database" || node.kind === "queue") &&
    node.workspaceId !== undefined
  ) {
    issues.push({
      code: "CONSTRAINT_VIOLATION",
      path: `/nodes/${index}/workspaceId`,
      message: `${node.kind} nodes must not have workspaceId`,
    });
  }

  const errors = issues.filter(
    (i) => i.code !== "INVALID_ID_FORMAT",
  );
  const warnings = issues.filter((i) => i.code === "INVALID_ID_FORMAT");
  if (errors.length > 0) {
    return validationFail(errors);
  }
  return validationOk(node, warnings.length > 0 ? warnings : undefined);
}

export type NodeValidationResult = ValidationResult<Node>;
