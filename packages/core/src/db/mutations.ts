import type Database from "better-sqlite3";

import type {
  ConcernSeverity,
  ConcernSource,
  EdgeStatus,
  EdgeType,
  NodeKind,
  NodeLayer,
  NodeStatus,
} from "../schema/enums.js";
import {
  deleteNodeChildren,
  insertNodeChildren,
  prepareNodeChildrenInserts,
} from "./node-children.js";

/** Input for full node upsert (replace child rows). */
export type UpsertNodeInput = {
  id: string;
  name: string;
  kind: NodeKind;
  status: NodeStatus;
  files: string[];
  workspaceId?: string;
  layer?: NodeLayer;
  tags?: string[];
  tech?: string[];
  description?: string;
};

/** Input for edge upsert. */
export type UpsertEdgeInput = {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  status: EdgeStatus;
  description?: string;
};

/** Input for partial node update. */
export type PatchNodeInput = {
  id: string;
  name?: string;
  status?: NodeStatus;
  layer?: NodeLayer | null;
  files?: string[];
  tags?: string[];
  tech?: string[];
  description?: string | null;
};

/** Input for inserting a new concern. */
export type InsertConcernInput = {
  id: string;
  scope: string;
  severity: ConcernSeverity;
  source: ConcernSource;
  description: string;
};

type NodePatchRow = {
  name: string;
  status: string;
  layer: string | null;
  metadata_json: string | null;
};

/**
 * Return whether a node with the given ID exists.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param id - Node ID to check.
 * @returns `true` when a matching node row exists.
 */
export function nodeExists(db: Database.Database, id: string): boolean {
  const row = db.prepare(`SELECT 1 FROM nodes WHERE id = ?`).get(id);
  return row !== undefined;
}

/**
 * Return whether a workspace with the given ID exists.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param id - Workspace ID to check.
 * @returns `true` when a matching workspace row exists.
 */
export function workspaceExists(db: Database.Database, id: string): boolean {
  const row = db.prepare(`SELECT 1 FROM workspaces WHERE id = ?`).get(id);
  return row !== undefined;
}

/**
 * Insert or fully replace a node and its child rows (files, tags, tech).
 *
 * @param db - Open better-sqlite3 database handle.
 * @param input - Node fields to persist.
 */
export function upsertNode(db: Database.Database, input: UpsertNodeInput): void {
  const metadataJson =
    input.description !== undefined ? JSON.stringify({ description: input.description }) : null;

  const upsertNodeStmt = db.prepare(`
    INSERT INTO nodes (id, name, workspace_id, kind, status, layer, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, workspace_id=excluded.workspace_id, kind=excluded.kind,
      status=excluded.status, layer=excluded.layer, metadata_json=excluded.metadata_json
  `);

  const run = db.transaction(() => {
    deleteNodeChildren(db, input.id);
    upsertNodeStmt.run(
      input.id,
      input.name,
      input.workspaceId ?? null,
      input.kind,
      input.status,
      input.layer ?? null,
      metadataJson,
    );
    const childInserts = prepareNodeChildrenInserts(db);
    insertNodeChildren(childInserts, input.id, {
      files: input.files,
      tags: input.tags,
      tech: input.tech,
    });
  });

  run();
}

/**
 * Insert or update an edge row.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param input - Edge fields to persist.
 */
export function upsertEdge(db: Database.Database, input: UpsertEdgeInput): void {
  const metadataJson =
    input.description !== undefined ? JSON.stringify({ description: input.description }) : null;

  const upsertEdgeStmt = db.prepare(`
    INSERT INTO edges (id, from_id, to_id, type, status, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      from_id=excluded.from_id, to_id=excluded.to_id, type=excluded.type,
      status=excluded.status, metadata_json=excluded.metadata_json
  `);

  upsertEdgeStmt.run(input.id, input.from, input.to, input.type, input.status, metadataJson);
}

/**
 * Partially update an existing node. Only provided fields are changed.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param input - Fields to update.
 * @throws When the node does not exist.
 */
export function patchNode(db: Database.Database, input: PatchNodeInput): void {
  const row = db
    .prepare(`SELECT name, status, layer, metadata_json FROM nodes WHERE id = ?`)
    .get(input.id) as NodePatchRow | undefined;

  if (!row) {
    throw new Error(`Node '${input.id}' not found`);
  }

  const name = input.name ?? row.name;
  const status = input.status ?? row.status;
  let layer: string | null = row.layer;
  if (input.layer !== undefined) {
    layer = input.layer;
  }

  let metadataJson = row.metadata_json;
  if (input.description !== undefined) {
    const metadata: Record<string, unknown> = row.metadata_json
      ? (JSON.parse(row.metadata_json) as Record<string, unknown>)
      : {};
    if (input.description === null) {
      delete metadata.description;
    } else {
      metadata.description = input.description;
    }
    metadataJson = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
  }

  const updateNode = db.prepare(`
    UPDATE nodes SET name = ?, status = ?, layer = ?, metadata_json = ? WHERE id = ?
  `);
  const deleteFiles = db.prepare(`DELETE FROM node_files WHERE node_id = ?`);
  const deleteTags = db.prepare(`DELETE FROM node_tags WHERE node_id = ?`);
  const deleteTech = db.prepare(`DELETE FROM node_tech WHERE node_id = ?`);

  const run = db.transaction(() => {
    updateNode.run(name, status, layer, metadataJson, input.id);
    const childInserts = prepareNodeChildrenInserts(db);
    if (input.files !== undefined) {
      deleteFiles.run(input.id);
      insertNodeChildren(childInserts, input.id, { files: input.files });
    }
    if (input.tags !== undefined) {
      deleteTags.run(input.id);
      insertNodeChildren(childInserts, input.id, { tags: input.tags });
    }
    if (input.tech !== undefined) {
      deleteTech.run(input.id);
      insertNodeChildren(childInserts, input.id, { tech: input.tech });
    }
  });

  run();
}

/**
 * Insert a new open concern row.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param input - Concern fields to persist.
 */
export function insertConcern(db: Database.Database, input: InsertConcernInput): void {
  db.prepare(`
    INSERT INTO concerns (id, scope, severity, status, source, description)
    VALUES (?, ?, ?, 'open', ?, ?)
  `).run(input.id, input.scope, input.severity, input.source, input.description);
}
