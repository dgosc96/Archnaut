import type Database from "better-sqlite3";

import { ARCHNAUT_FILE_VERSION, type ArchnautFileV1 } from "../schema/archnaut-file.js";
import type { Concern } from "../schema/concern.js";
import type { Edge } from "../schema/edge.js";
import type { Meta } from "../schema/meta.js";
import type { Node } from "../schema/node.js";
import type { Project } from "../schema/project.js";
import type { Workspace } from "../schema/workspace.js";

/**
 * Reconstruct an `ArchnautFileV1` document from the SQLite projection.
 *
 * @param db - Open better-sqlite3 database handle with hydrated projection tables.
 * @returns Round-tripped architecture file assembled from relational rows.
 *
 * @remarks Intended for tests and dogfooding — not the production read path, which reads
 * `archnaut.json` directly. Ordering matches normalized file conventions (sorted by id).
 *
 * @throws When the database has no project row (empty or uninitialized projection).
 */
export function getArchitectureSnapshot(db: Database.Database): ArchnautFileV1 {
  const projectRow = db
    .prepare(`SELECT id, name, root, package_manager, monorepo FROM project LIMIT 1`)
    .get() as
    | {
        id: string;
        name: string;
        root: string;
        package_manager: string | null;
        monorepo: number;
      }
    | undefined;

  if (!projectRow) {
    throw new Error("Database has no project row");
  }

  const project: Project = {
    id: projectRow.id,
    name: projectRow.name,
    root: projectRow.root,
    monorepo: projectRow.monorepo === 1,
  };
  if (projectRow.package_manager) {
    project.packageManager = projectRow.package_manager as Project["packageManager"];
  }

  const workspaces = (
    db.prepare(`SELECT id, name, path, kind, tags_json FROM workspaces ORDER BY id`).all() as Array<{
      id: string;
      name: string;
      path: string;
      kind: string;
      tags_json: string | null;
    }>
  ).map((row): Workspace => {
    const ws: Workspace = {
      id: row.id,
      name: row.name,
      path: row.path,
      kind: row.kind as Workspace["kind"],
    };
    if (row.tags_json) {
      ws.tags = JSON.parse(row.tags_json) as string[];
    }
    return ws;
  });

  const nodeRows = db
    .prepare(`SELECT id, name, workspace_id, kind, status, layer, metadata_json FROM nodes ORDER BY id`)
    .all() as Array<{
    id: string;
    name: string;
    workspace_id: string | null;
    kind: string;
    status: string;
    layer: string | null;
    metadata_json: string | null;
  }>;

  const nodes: Node[] = nodeRows.map((row) => {
    const files = (
      db
        .prepare(`SELECT path FROM node_files WHERE node_id = ? ORDER BY ord`)
        .all(row.id) as Array<{ path: string }>
    ).map((r) => r.path);

    const tags = (
      db.prepare(`SELECT tag FROM node_tags WHERE node_id = ? ORDER BY tag`).all(row.id) as Array<{
        tag: string;
      }>
    ).map((r) => r.tag);

    const tech = (
      db.prepare(`SELECT tech FROM node_tech WHERE node_id = ? ORDER BY tech`).all(row.id) as Array<{
        tech: string;
      }>
    ).map((r) => r.tech);

    const node: Node = {
      id: row.id,
      name: row.name,
      kind: row.kind as Node["kind"],
      status: row.status as Node["status"],
      files,
    };
    if (row.workspace_id) node.workspaceId = row.workspace_id;
    if (row.layer) node.layer = row.layer as Node["layer"];
    if (row.metadata_json) node.metadata = JSON.parse(row.metadata_json) as Node["metadata"];
    if (tags.length > 0) node.tags = tags;
    if (tech.length > 0) node.tech = tech;
    return node;
  });

  const edges = (
    db
      .prepare(`SELECT id, from_id, to_id, type, status, metadata_json FROM edges ORDER BY id`)
      .all() as Array<{
      id: string;
      from_id: string;
      to_id: string;
      type: string;
      status: string;
      metadata_json: string | null;
    }>
  ).map((row): Edge => {
    const edge: Edge = {
      id: row.id,
      from: row.from_id,
      to: row.to_id,
      type: row.type as Edge["type"],
      status: row.status as Edge["status"],
    };
    if (row.metadata_json) {
      edge.metadata = JSON.parse(row.metadata_json) as Edge["metadata"];
    }
    return edge;
  });

  const concerns = (
    db
      .prepare(
        `SELECT id, scope, severity, status, source, description FROM concerns ORDER BY id`,
      )
      .all() as Concern[]
  );

  const metaRows = db.prepare(`SELECT key, value_json FROM meta`).all() as Array<{
    key: string;
    value_json: string;
  }>;

  const meta: Meta = {};
  for (const row of metaRows) {
    const value: unknown = JSON.parse(row.value_json);
    switch (row.key) {
      case "schemaVersion":
        meta.schemaVersion = value as string;
        break;
      case "createdBy":
        meta.createdBy = value as string;
        break;
      case "lastNormalizedAt":
        meta.lastNormalizedAt = value as string;
        break;
      case "hookPolicy":
        meta.hookPolicy = value as Meta["hookPolicy"];
        break;
      case "layout":
        meta.layout = value as Meta["layout"];
        break;
    }
  }

  return {
    version: ARCHNAUT_FILE_VERSION,
    project,
    workspaces,
    nodes,
    edges,
    concerns,
    meta,
  };
}
