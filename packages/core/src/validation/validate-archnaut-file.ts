import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { archnautFileSchema } from "./schemas/archnaut-file.schema.js";
import type { ValidationIssue } from "./issues.js";
import {
  partitionIssues,
  validationFail,
  validationOk,
} from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";
import {
  createValidationContext,
  findDuplicateIds,
  isMalformedId,
} from "./validation-context.js";
import { validateConcern } from "./validate-concern.js";
import { validateEdge } from "./validate-edge.js";
import { validateMeta } from "./validate-meta.js";
import { validateNode } from "./validate-node.js";
import { validateWorkspace } from "./validate-workspace.js";

/**
 * Validate a full `archnaut.json` document (structural Zod parse plus semantic cross-field checks).
 * Collects all issues before returning; duplicate IDs, missing references, and constraint violations are errors.
 *
 * @param value - Raw parsed JSON or unknown input.
 * @returns On success, `{ ok: true, value: ArchnautFileV1, warnings? }`; on failure, `{ ok: false, issues }`.
 */
export function validateArchnautFile(value: unknown): import("./issues.js").ValidationResult<ArchnautFileV1> {
  if (value !== null && typeof value === "object" && "version" in value) {
    const version = (value as { version: unknown }).version;
    if (version !== 1) {
      return validationFail([
        {
          code: "INVALID_VERSION",
          path: "/version",
          message: `Unsupported version ${String(version)}; expected 1`,
        },
      ]);
    }
  }

  const parsed = archnautFileSchema.safeParse(value);
  if (!parsed.success) {
    return validationFail(zodIssuesToValidationIssues(parsed.error));
  }

  const file = parsed.data;
  const allIssues: ValidationIssue[] = [];

  allIssues.push(...findDuplicateIds(file.workspaces, "/workspaces"));
  allIssues.push(...findDuplicateIds(file.nodes, "/nodes"));
  allIssues.push(...findDuplicateIds(file.edges, "/edges"));
  allIssues.push(...findDuplicateIds(file.concerns, "/concerns"));

  const globalIds = new Map<string, string>();
  const trackGlobal = (id: string, path: string) => {
    const existing = globalIds.get(id);
    if (existing) {
      allIssues.push({
        code: "DUPLICATE_ID",
        path,
        message: `Id ${JSON.stringify(id)} collides with ${existing}`,
      });
    } else {
      globalIds.set(id, path);
    }
  };

  file.workspaces.forEach((ws, i) => trackGlobal(ws.id, `/workspaces/${i}/id`));
  file.nodes.forEach((n, i) => trackGlobal(n.id, `/nodes/${i}/id`));
  file.edges.forEach((e, i) => trackGlobal(e.id, `/edges/${i}/id`));
  file.concerns.forEach((c, i) => trackGlobal(c.id, `/concerns/${i}/id`));

  if (!isMalformedId(file.project.id)) {
    // project ids use repo.* convention — no strict prefix enforcement
  } else {
    allIssues.push({
      code: "INVALID_ID_FORMAT",
      path: "/project/id",
      message: `Malformed project id: ${JSON.stringify(file.project.id)}`,
    });
  }

  const ctx = createValidationContext();
  for (const ws of file.workspaces) {
    ctx.workspaceIds.add(ws.id);
  }
  for (const node of file.nodes) {
    ctx.nodeIds.add(node.id);
  }
  for (const edge of file.edges) {
    ctx.edgeIds.add(edge.id);
  }

  file.workspaces.forEach((ws, index) => {
    const result = validateWorkspace(ws, ctx, index);
    if (!result.ok) {
      allIssues.push(...result.issues);
    } else if (result.warnings) {
      allIssues.push(...result.warnings);
    }
  });

  file.nodes.forEach((node, index) => {
    const result = validateNode(node, ctx, index);
    if (!result.ok) {
      allIssues.push(...result.issues);
    } else if (result.warnings) {
      allIssues.push(...result.warnings);
    }
  });

  file.edges.forEach((edge, index) => {
    const result = validateEdge(edge, ctx, index, file.edges);
    if (!result.ok) {
      allIssues.push(...result.issues);
    } else if (result.warnings) {
      allIssues.push(...result.warnings);
    }
  });

  file.concerns.forEach((concern, index) => {
    const result = validateConcern(concern, ctx, index);
    if (!result.ok) {
      allIssues.push(...result.issues);
    } else if (result.warnings) {
      allIssues.push(...result.warnings);
    }
  });

  const metaResult = validateMeta(file.meta, ctx);
  if (!metaResult.ok) {
    allIssues.push(...metaResult.issues);
  } else if (metaResult.warnings) {
    allIssues.push(...metaResult.warnings);
  }

  const { errors, warnings } = partitionIssues(allIssues);
  if (errors.length > 0) {
    return validationFail(errors.concat(warnings));
  }
  return validationOk(file, warnings.length > 0 ? warnings : undefined);
}
