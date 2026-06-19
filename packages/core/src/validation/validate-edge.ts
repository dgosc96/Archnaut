import { edgeSchema, type Edge } from "./schemas/edge.schema.js";
import type { ValidationContext } from "./validation-context.js";
import type { ValidationResult } from "./issues.js";
import { validationFail, validationOk } from "./issues.js";
import { zodIssuesToValidationIssues } from "./zod-mapper.js";
import { checkIdFormat } from "./validation-context.js";

export function validateEdge(
  value: unknown,
  ctx: ValidationContext,
  index: number,
  allEdges: Edge[],
): ValidationResult<Edge> {
  const result = edgeSchema.safeParse(value);
  if (!result.success) {
    return validationFail(zodIssuesToValidationIssues(result.error));
  }

  const edge = result.data;
  const issues = checkIdFormat(edge.id, `/edges/${index}/id`, "edge");

  if (!ctx.nodeIds.has(edge.from)) {
    issues.push({
      code: "MISSING_REFERENCE",
      path: `/edges/${index}/from`,
      message: `from node ${JSON.stringify(edge.from)} not found`,
    });
  }

  if (!ctx.nodeIds.has(edge.to)) {
    issues.push({
      code: "MISSING_REFERENCE",
      path: `/edges/${index}/to`,
      message: `to node ${JSON.stringify(edge.to)} not found`,
    });
  }

  if (edge.from === edge.to) {
    issues.push({
      code: "CONSTRAINT_VIOLATION",
      path: `/edges/${index}`,
      message: "Edge must not connect a node to itself",
    });
  }

  const duplicateTriple = allEdges.findIndex(
    (e, i) =>
      i < index &&
      e.from === edge.from &&
      e.to === edge.to &&
      e.type === edge.type,
  );
  if (duplicateTriple >= 0) {
    issues.push({
      code: "CONSTRAINT_VIOLATION",
      path: `/edges/${index}`,
      message: `Duplicate edge (${edge.from}, ${edge.to}, ${edge.type}) also at /edges/${duplicateTriple}`,
    });
  }

  const errors = issues.filter((i) => i.code !== "INVALID_ID_FORMAT");
  const warnings = issues.filter((i) => i.code === "INVALID_ID_FORMAT");
  if (errors.length > 0) {
    return validationFail(errors);
  }
  return validationOk(edge, warnings.length > 0 ? warnings : undefined);
}
