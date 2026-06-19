import type { ZodError } from "zod";
import type { ValidationIssue, ValidationIssueCode } from "./issues.js";

function zodIssueCode(issue: ZodError["issues"][number]): ValidationIssueCode {
  if (issue.code === "invalid_enum_value" || issue.code === "invalid_literal") {
    return "INVALID_ENUM";
  }
  if (issue.path[0] === "version") {
    return "INVALID_VERSION";
  }
  return "INVALID_TYPE";
}

function formatPath(path: (string | number)[]): string {
  if (path.length === 0) {
    return "/";
  }
  return "/" + path.map(String).join("/");
}

export function zodIssuesToValidationIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code: zodIssueCode(issue),
    path: formatPath(issue.path),
    message: issue.message,
  }));
}
