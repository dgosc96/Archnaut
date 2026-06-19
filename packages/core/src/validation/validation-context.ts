import type { ValidationIssue } from "./issues.js";
import { parseWorkspaceId } from "../ids/parse-workspace-id.js";
import { parseNodeId } from "../ids/parse-node-id.js";

export interface ValidationContext {
  workspaceIds: Set<string>;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  concernIds: Set<string>;
}

export function createValidationContext(): ValidationContext {
  return {
    workspaceIds: new Set(),
    nodeIds: new Set(),
    edgeIds: new Set(),
    concernIds: new Set(),
  };
}

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function isMalformedId(id: string): boolean {
  return id.trim() === "" || /\s/.test(id) || !ID_PATTERN.test(id);
}

export function checkIdFormat(
  id: string,
  path: string,
  kind: "workspace" | "node" | "edge" | "concern",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (isMalformedId(id)) {
    issues.push({
      code: "INVALID_ID_FORMAT",
      path,
      message: `Malformed ${kind} id: ${JSON.stringify(id)}`,
    });
    return issues;
  }

  if (kind === "workspace" && !parseWorkspaceId(id)) {
    issues.push({
      code: "INVALID_ID_FORMAT",
      path,
      message: `Workspace id should match ws.<name> pattern: ${id}`,
    });
  } else if (kind === "node" && !parseNodeId(id)) {
    issues.push({
      code: "INVALID_ID_FORMAT",
      path,
      message: `Node id should match semantic prefix pattern: ${id}`,
    });
  } else if (kind === "edge" && !id.startsWith("edge.")) {
    issues.push({
      code: "INVALID_ID_FORMAT",
      path,
      message: `Edge id should start with edge.: ${id}`,
    });
  } else if (kind === "concern" && !id.startsWith("concern.")) {
    issues.push({
      code: "INVALID_ID_FORMAT",
      path,
      message: `Concern id should start with concern.: ${id}`,
    });
  }

  return issues;
}

export function findDuplicateIds(
  items: Array<{ id: string }>,
  basePath: string,
): ValidationIssue[] {
  const seen = new Map<string, number>();
  const issues: ValidationIssue[] = [];

  items.forEach((item, index) => {
    const first = seen.get(item.id);
    if (first !== undefined) {
      issues.push({
        code: "DUPLICATE_ID",
        path: `${basePath}/${index}/id`,
        message: `Duplicate id ${JSON.stringify(item.id)} (also at ${basePath}/${first}/id)`,
      });
    } else {
      seen.set(item.id, index);
    }
  });

  return issues;
}
