/** Discriminant codes for validation findings; some are non-blocking (see {@link WARNING_CODES}). */
export type ValidationIssueCode =
  | "INVALID_TYPE"
  | "INVALID_ENUM"
  | "INVALID_VERSION"
  | "DUPLICATE_ID"
  | "MISSING_REFERENCE"
  | "INVALID_ID_FORMAT"
  | "ORPHAN_LAYOUT"
  | "CONSTRAINT_VIOLATION";

/** A single validation finding with JSON-pointer path and human-readable message. */
export interface ValidationIssue {
  code: ValidationIssueCode;
  path: string;
  message: string;
}

/**
 * Outcome of validating a value against the Archnaut schema.
 * Success carries the typed `value` and optional non-blocking `warnings`.
 * Failure carries blocking `issues` (warnings may be included when aggregated).
 */
export type ValidationResult<T> =
  | { ok: true; value: T; warnings?: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Build a successful validation result.
 *
 * @param value - Parsed and semantically checked value.
 * @param warnings - Optional non-blocking issues (e.g. `INVALID_ID_FORMAT`).
 * @returns `{ ok: true, value, warnings? }`.
 */
export function validationOk<T>(value: T, warnings?: ValidationIssue[]): ValidationResult<T> {
  if (warnings && warnings.length > 0) {
    return { ok: true, value, warnings };
  }
  return { ok: true, value };
}

/**
 * Build a failed validation result.
 *
 * @param issues - Blocking errors collected during validation.
 * @returns `{ ok: false, issues }`.
 */
export function validationFail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

/** Issue codes that do not block validation success (`INVALID_ID_FORMAT`, `ORPHAN_LAYOUT`). */
export const WARNING_CODES: ReadonlySet<ValidationIssueCode> = new Set([
  "INVALID_ID_FORMAT",
  "ORPHAN_LAYOUT",
]);

/**
 * Split validation issues into blocking errors and non-blocking warnings.
 *
 * @param issues - Combined issues from structural and semantic validation.
 * @returns Partitioned errors and warnings per {@link WARNING_CODES}.
 */
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
