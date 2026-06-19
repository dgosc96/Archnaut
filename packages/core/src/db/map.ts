import type { Concern } from "../validation/schemas/concern.schema.js";
import type { Edge } from "../validation/schemas/edge.schema.js";
import type { Meta } from "../validation/schemas/meta.schema.js";
import type { Node } from "../validation/schemas/node.schema.js";
import type { Project } from "../validation/schemas/project.schema.js";
import type { Workspace } from "../validation/schemas/workspace.schema.js";

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

export function concernToRow(concern: Concern): Concern {
  return concern;
}

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
