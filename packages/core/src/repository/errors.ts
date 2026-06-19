import type { ValidationIssue } from "../validation/issues.js";

export class ArchnautFileNotFoundError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`archnaut.json not found: ${path}`);
    this.name = "ArchnautFileNotFoundError";
    this.path = path;
  }
}

export class ArchnautParseError extends Error {
  readonly path: string;
  override readonly cause?: unknown;

  constructor(path: string, cause?: unknown) {
    super(`Failed to parse archnaut.json at ${path}`);
    this.name = "ArchnautParseError";
    this.path = path;
    this.cause = cause;
  }
}

export class ArchnautValidationError extends Error {
  readonly path: string;
  readonly issues: ValidationIssue[];

  constructor(path: string, issues: ValidationIssue[]) {
    super(`archnaut.json validation failed at ${path} (${issues.length} issue(s))`);
    this.name = "ArchnautValidationError";
    this.path = path;
    this.issues = issues;
  }
}

export class ArchnautWriteError extends Error {
  readonly path: string;
  override readonly cause?: unknown;

  constructor(path: string, cause?: unknown) {
    super(`Failed to write archnaut.json at ${path}`);
    this.name = "ArchnautWriteError";
    this.path = path;
    this.cause = cause;
  }
}
