import type { ValidationResult } from "./issues.js";
import { isMalformedId } from "./validation-context.js";
import type { Project } from "../schema/project.js";
import { projectSchema } from "./schemas/project.schema.js";
import { validationFail, validationOk } from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";

/**
 * Validate project metadata (schema and basic id format).
 *
 * @param value - Raw project object.
 * @returns On success, `{ ok: true, value: Project }`; on failure, `{ ok: false, issues }`.
 */
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
