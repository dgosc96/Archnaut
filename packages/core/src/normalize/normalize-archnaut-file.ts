import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import type { Workspace } from "../schema/workspace.js";
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

/**
 * Produce a canonical, diff-friendly copy of an architecture file.
 *
 * @param file - Validated `archnaut.json` document.
 * @returns Normalized file with sorted arrays, normalized paths, and updated meta timestamps.
 * @remarks Deterministic ordering: `workspaces`, `nodes`, `edges`, and `concerns` are sorted by `id`
 * ascending via {@link sortById}. Node `files`/`tags`/`tech` are deduped and sorted. Layout keys are
 * sorted and pruned for unknown nodes. `meta.lastNormalizedAt` is set to the current ISO timestamp.
 */
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
