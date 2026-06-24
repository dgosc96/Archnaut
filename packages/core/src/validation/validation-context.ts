import type { ValidationIssue } from "./issues.js";
import { parseWorkspaceId } from "../ids/parse-workspace-id.js";
import { parseNodeId } from "../ids/parse-node-id.js";

/**
 * Cross-entity ID registry built while validating an `archnaut.json` file.
 * Per-entity validators use these sets to resolve references.
 */
export interface ValidationContext {
  workspaceIds: Set<string>;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  concernIds: Set<string>;
}

/**
 * Create an empty cross-entity ID registry for file-level validation.
 *
 * @returns Fresh context with empty ID sets.
 */
export function createValidationContext(): ValidationContext {
  return {
    workspaceIds: new Set(),
    nodeIds: new Set(),
    edgeIds: new Set(),
    concernIds: new Set(),
  };
}

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Return true when `id` is empty, contains whitespace, or fails the generic ID character pattern.
 *
 * @param id - Candidate identifier string.
 * @returns Whether the id fails basic structural checks.
 */
export function isMalformedId(id: string): boolean {
  return id.trim() === "" || /\s/.test(id) || !ID_PATTERN.test(id);
}

/**
 * Validate semantic ID format for a workspace, node, edge, or concern (non-blocking warnings).
 *
 * @param id - Identifier under test.
 * @param path - JSON pointer for the issue report.
 * @param kind - Entity kind driving prefix rules.
 * @returns Non-blocking `INVALID_ID_FORMAT` issues (empty when valid).
 */
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

/**
 * Detect duplicate `id` values within a collection and emit `DUPLICATE_ID` issues.
 *
 * @param items - Entities with an `id` field to scan.
 * @param basePath - JSON pointer prefix for the collection.
 * @returns One issue per duplicate after the first occurrence.
 */
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
