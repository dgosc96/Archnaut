import { workspaceSchema, type Workspace } from "./schemas/workspace.schema.js";
import type { ValidationContext } from "./validation-context.js";
import type { ValidationResult } from "./issues.js";
import { validationFail, validationOk } from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";
import { checkIdFormat } from "./validation-context.js";

export function validateWorkspace(
  value: unknown,
  _ctx: ValidationContext,
  index: number,
): ValidationResult<Workspace> {
  const result = workspaceSchema.safeParse(value);
  if (!result.success) {
    return validationFail(zodIssuesToValidationIssues(result.error));
  }

  const issues = checkIdFormat(result.data.id, `/workspaces/${index}/id`, "workspace");

  const errors = issues.filter((i) => i.code !== "INVALID_ID_FORMAT");
  const warnings = issues.filter((i) => i.code === "INVALID_ID_FORMAT");
  if (errors.length > 0) {
    return validationFail(errors);
  }
  return validationOk(result.data, warnings.length > 0 ? warnings : undefined);
}
