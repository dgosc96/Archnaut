export type ValidationIssueCode =
  | "INVALID_TYPE"
  | "INVALID_ENUM"
  | "INVALID_VERSION"
  | "DUPLICATE_ID"
  | "MISSING_REFERENCE"
  | "INVALID_ID_FORMAT"
  | "ORPHAN_LAYOUT"
  | "CONSTRAINT_VIOLATION";

export interface ValidationIssue {
  code: ValidationIssueCode;
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T; warnings?: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

export function validationOk<T>(value: T, warnings?: ValidationIssue[]): ValidationResult<T> {
  if (warnings && warnings.length > 0) {
    return { ok: true, value, warnings };
  }
  return { ok: true, value };
}

export function validationFail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

/** Issue codes that do not block validation success. */
export const WARNING_CODES: ReadonlySet<ValidationIssueCode> = new Set([
  "INVALID_ID_FORMAT",
  "ORPHAN_LAYOUT",
]);

export function partitionIssues(issues: ValidationIssue[]): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  for (const issue of issues) {
    if (WARNING_CODES.has(issue.code)) {
      warnings.push(issue);
    } else {
      errors.push(issue);
    }
  }
  return { errors, warnings };
}
