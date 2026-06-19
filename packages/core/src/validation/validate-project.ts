import type { ValidationResult } from "./issues.js";
import { isMalformedId } from "./validation-context.js";
import { projectSchema, type Project } from "./schemas/project.schema.js";
import { validationFail, validationOk } from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";

export function validateProject(value: unknown): ValidationResult<Project> {
  const result = projectSchema.safeParse(value);
  if (!result.success) {
    return validationFail(zodIssuesToValidationIssues(result.error));
  }
  if (isMalformedId(result.data.id)) {
    return validationFail([
      {
        code: "INVALID_ID_FORMAT",
        path: "/project/id",
        message: `Malformed project id: ${JSON.stringify(result.data.id)}`,
      },
    ]);
  }
  return validationOk(result.data);
}
