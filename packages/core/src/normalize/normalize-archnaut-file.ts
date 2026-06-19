import type { ArchnautFileV1 } from "../validation/schemas/archnaut-file.schema.js";
import type { Workspace } from "../validation/schemas/workspace.schema.js";
import { normalizeEdge } from "./normalize-edge.js";
import { normalizeMeta, normalizeWorkspaceTags } from "./normalize-meta.js";
import { normalizeNode } from "./normalize-node.js";
import { sortById } from "./sort.js";

function normalizeRootPath(root: string): string {
  return root.replace(/\\/g, "/");
}

function normalizeWorkspace(workspace: Workspace): Workspace {
  const normalized: Workspace = {
    id: workspace.id,
    name: workspace.name,
    path: workspace.path.replace(/\\/g, "/"),
    kind: workspace.kind,
  };
  const tags = normalizeWorkspaceTags(workspace.tags);
  if (tags) {
    normalized.tags = tags;
  }
  return normalized;
}

export function normalizeArchnautFile(file: ArchnautFileV1): ArchnautFileV1 {
  const nodes = sortById(file.nodes.map(normalizeNode));
  const nodeIds = new Set(nodes.map((n) => n.id));

  return {
    version: 1,
    project: {
      ...file.project,
      root: normalizeRootPath(file.project.root),
    },
    workspaces: sortById(file.workspaces.map(normalizeWorkspace)),
    nodes,
    edges: sortById(file.edges.map(normalizeEdge)),
    concerns: sortById(file.concerns),
    meta: normalizeMeta(file.meta, nodeIds),
  };
}
