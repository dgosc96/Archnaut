import type Database from "better-sqlite3";

import type { ArchnautFileV1 } from "../schema/archnaut-file.js";
import { clearArchitectureProjection } from "./migrate.js";
import { insertNodeChildren, prepareNodeChildrenInserts } from "./node-children.js";
import {
  concernToRow,
  edgeToRow,
  metaToRows,
  nodeToRow,
  projectToRow,
  workspaceToRow,
} from "./map.js";

/**
 * Hydrate the SQLite projection from a normalized `archnaut.json` document.
 *
 * @param file - Normalized architecture file to project into relational tables.
 * @param db - Open better-sqlite3 database handle (schema should already exist).
 *
 * @remarks Runs inside a single transaction: {@link clearArchitectureProjection} wipes architecture
 * tables (tasks are preserved), then project,
 * workspaces, nodes (with files/tags/tech), edges, concerns, and meta rows are inserted.
 * The DB is a runtime mirror of the file — not an incremental merge.
 */
export function initDbFromFile(file: ArchnautFileV1, db: Database.Database): void {
  const run = db.transaction(() => {
    clearArchitectureProjection(db);

    const insertProject = db.prepare(`
      INSERT INTO project (id, name, root, package_manager, monorepo)
      VALUES (@id, @name, @root, @package_manager, @monorepo)
    `);
    insertProject.run(projectToRow(file.project));

    const insertWorkspace = db.prepare(`
      INSERT INTO workspaces (id, name, path, kind, tags_json)
      VALUES (@id, @name, @path, @kind, @tags_json)
    `);
    for (const ws of file.workspaces) {
      insertWorkspace.run(workspaceToRow(ws));
    }

    const insertNode = db.prepare(`
      INSERT INTO nodes (id, name, workspace_id, kind, status, layer, metadata_json)
      VALUES (@id, @name, @workspace_id, @kind, @status, @layer, @metadata_json)
    `);
    const childInserts = prepareNodeChildrenInserts(db);

    for (const node of file.nodes) {
      insertNode.run(nodeToRow(node));
      insertNodeChildren(childInserts, node.id, {
        files: node.files,
        tags: node.tags,
        tech: node.tech,
      });
    }

    const insertEdge = db.prepare(`
      INSERT INTO edges (id, from_id, to_id, type, status, metadata_json)
      VALUES (@id, @from_id, @to_id, @type, @status, @metadata_json)
    `);
    for (const edge of file.edges) {
      insertEdge.run(edgeToRow(edge));
    }

    const insertConcern = db.prepare(`
      INSERT INTO concerns (id, scope, severity, status, source, description)
      VALUES (@id, @scope, @severity, @status, @source, @description)
    `);
    for (const concern of file.concerns) {
      insertConcern.run(concernToRow(concern));
    }

    const insertMeta = db.prepare(`
      INSERT INTO meta (key, value_json) VALUES (@key, @value_json)
    `);
    for (const row of metaToRows(file.meta)) {
      insertMeta.run(row);
    }
  });

  run();
}
