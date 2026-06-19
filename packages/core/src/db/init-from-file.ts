import type Database from "better-sqlite3";

import type { ArchnautFileV1 } from "../validation/schemas/archnaut-file.schema.js";
import { clearDb } from "./migrate.js";
import {
  concernToRow,
  edgeToRow,
  metaToRows,
  nodeToRow,
  projectToRow,
  workspaceToRow,
} from "./map.js";

export function initDbFromFile(file: ArchnautFileV1, db: Database.Database): void {
  const run = db.transaction(() => {
    clearDb(db);

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
    const insertFile = db.prepare(`
      INSERT INTO node_files (node_id, path, ord) VALUES (?, ?, ?)
    `);
    const insertTag = db.prepare(`
      INSERT INTO node_tags (node_id, tag) VALUES (?, ?)
    `);
    const insertTech = db.prepare(`
      INSERT INTO node_tech (node_id, tech) VALUES (?, ?)
    `);

    for (const node of file.nodes) {
      insertNode.run(nodeToRow(node));
      node.files.forEach((filePath, ord) => {
        insertFile.run(node.id, filePath, ord);
      });
      node.tags?.forEach((tag) => insertTag.run(node.id, tag));
      node.tech?.forEach((tech) => insertTech.run(node.id, tech));
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
