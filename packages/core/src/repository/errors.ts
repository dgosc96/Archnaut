import type { ValidationIssue } from "../validation/issues.js";

/** Thrown when `archnaut.json` does not exist at the requested path (`ENOENT`). */
export class ArchnautFileNotFoundError extends Error {
  /** Absolute or relative path that was missing on disk. */
  readonly path: string;

  /** @param path - Absolute or relative path that was missing on disk. */
  constructor(path: string) {
    super(`archnaut.json not found: ${path}`);
    this.name = "ArchnautFileNotFoundError";
    this.path = path;
  }
}

/** Thrown when `archnaut.json` exists but contains invalid JSON. */
export class ArchnautParseError extends Error {
  /** Path to the file that failed to parse. */
  readonly path: string;
  override readonly cause?: unknown;

  /**
   * @param path - Path to the file that failed to parse.
   * @param cause - Optional underlying parse error.
   */
  constructor(path: string, cause?: unknown) {
    super(`Failed to parse archnaut.json at ${path}`);
    this.name = "ArchnautParseError";
    this.path = path;
    this.cause = cause;
  }
}

/** Thrown when `archnaut.json` fails structural or semantic validation. */
export class ArchnautValidationError extends Error {
  /** Path to the file that failed validation. */
  readonly path: string;
  /** Collect-all validation issues that blocked loading. */
  readonly issues: ValidationIssue[];

  /**
   * @param path - Path to the file that failed validation.
   * @param issues - Collect-all validation issues that blocked loading.
   */
  constructor(path: string, issues: ValidationIssue[]) {
    super(`archnaut.json validation failed at ${path} (${issues.length} issue(s))`);
    this.name = "ArchnautValidationError";
    this.path = path;
    this.issues = issues;
  }
}

/** Thrown when an atomic write of `archnaut.json` fails. */
export class ArchnautWriteError extends Error {
  /** Target path for the failed write. */
  readonly path: string;
  override readonly cause?: unknown;

  /**
   * @param path - Target path for the failed write.
   * @param cause - Optional underlying filesystem error.
   */
  constructor(path: string, cause?: unknown) {
    super(`Failed to write archnaut.json at ${path}`);
    this.name = "ArchnautWriteError";
    this.path = path;
    this.cause = cause;
  }
}
