import type { Concern } from "../schema/concern.js";
import type { Edge } from "../schema/edge.js";
import type { Meta } from "../schema/meta.js";
import type { Node } from "../schema/node.js";
import type { Project } from "../schema/project.js";
import type { Workspace } from "../schema/workspace.js";

/**
 * Map a {@link Project} to the SQLite `project` table row shape.
 *
 * @param project - Domain project metadata.
 * @returns Column values for the single `project` row.
 */
export function projectToRow(project: Project): {
  id: string;
  name: string;
  root: string;
  package_manager: string | null;
  monorepo: number;
} {
  return {
    id: project.id,
    name: project.name,
    root: project.root,
    package_manager: project.packageManager ?? null,
    monorepo: project.monorepo ? 1 : 0,
  };
}

/**
 * Map a {@link Workspace} to the SQLite `workspaces` table row shape.
 *
 * @param workspace - Monorepo workspace entry.
 * @returns Column values for one workspace row.
 */
export function workspaceToRow(workspace: Workspace): {
  id: string;
  name: string;
  path: string;
  kind: string;
  tags_json: string | null;
} {
  return {
    id: workspace.id,
    name: workspace.name,
    path: workspace.path,
    kind: workspace.kind,
    tags_json: workspace.tags ? JSON.stringify(workspace.tags) : null,
  };
}

/**
 * Map a {@link Node} to the SQLite `nodes` table row shape (files stored separately).
 *
 * @param node - Architecture graph node.
 * @returns Column values for one node row.
 */
export function nodeToRow(node: Node): {
  id: string;
  name: string;
  workspace_id: string | null;
  kind: string;
  status: string;
  layer: string | null;
  metadata_json: string | null;
} {
  return {
    id: node.id,
    name: node.name,
    workspace_id: node.workspaceId ?? null,
    kind: node.kind,
    status: node.status,
    layer: node.layer ?? null,
    metadata_json: node.metadata ? JSON.stringify(node.metadata) : null,
  };
}

/**
 * Map an {@link Edge} to the SQLite `edges` table row shape.
 *
 * @param edge - Dependency relationship between nodes.
 * @returns Column values for one edge row.
 */
export function edgeToRow(edge: Edge): {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  status: string;
  metadata_json: string | null;
} {
  return {
    id: edge.id,
    from_id: edge.from,
    to_id: edge.to,
    type: edge.type,
    status: edge.status,
    metadata_json: edge.metadata ? JSON.stringify(edge.metadata) : null,
  };
}

/**
 * Identity map for concerns — row shape matches the domain object.
 *
 * @param concern - Architectural concern to persist.
 * @returns The same concern (no column flattening).
 */
export function concernToRow(concern: Concern): Concern {
  return concern;
}

/**
 * Flatten {@link Meta} into key/value rows for the SQLite `meta` table.
 *
 * @param meta - File-level metadata block.
 * @returns One row per defined meta field.
 */
export function metaToRows(meta: Meta): Array<{ key: string; value_json: string }> {
  const rows: Array<{ key: string; value_json: string }> = [];
  if (meta.schemaVersion !== undefined) {
    rows.push({ key: "schemaVersion", value_json: JSON.stringify(meta.schemaVersion) });
  }
  if (meta.createdBy !== undefined) {
    rows.push({ key: "createdBy", value_json: JSON.stringify(meta.createdBy) });
  }
  if (meta.lastNormalizedAt !== undefined) {
    rows.push({ key: "lastNormalizedAt", value_json: JSON.stringify(meta.lastNormalizedAt) });
  }
  if (meta.hookPolicy !== undefined) {
    rows.push({ key: "hookPolicy", value_json: JSON.stringify(meta.hookPolicy) });
  }
  if (meta.layout !== undefined) {
    rows.push({ key: "layout", value_json: JSON.stringify(meta.layout) });
  }
  return rows;
}
