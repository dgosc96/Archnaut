import path from "node:path";

import { ARCHNAUT_FILE_VERSION, type ArchnautFileV1 } from "../schema/archnaut-file.js";

/**
 * Build a minimal valid empty architecture document for bootstrap before the first scan.
 *
 * @param projectRoot - Absolute path to the repository root (parent of `archnaut.json`).
 * @returns Empty v1 document with project metadata derived from the directory name.
 */
export function createBootstrapArchitecture(projectRoot: string): ArchnautFileV1 {
  const name = path.basename(projectRoot);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";

  return {
    version: ARCHNAUT_FILE_VERSION,
    project: {
      id: `repo.${slug}`,
      name,
      root: ".",
      monorepo: false,
    },
    workspaces: [],
    nodes: [],
    edges: [],
    concerns: [],
    meta: {},
  };
}
