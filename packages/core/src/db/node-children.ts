import type Database from "better-sqlite3";
import type { Statement } from "better-sqlite3";

/** Child row collections attached to a node. */
export type NodeChildrenInput = {
  files?: string[];
  tags?: string[];
  tech?: string[];
};

/** Pre-prepared INSERT statements for node child tables. */
export type NodeChildrenInsertStatements = {
  insertFile: Statement;
  insertTag: Statement;
  insertTech: Statement;
};

/**
 * Prepare INSERT statements for node child tables (files, tags, tech).
 *
 * @param db - Open better-sqlite3 database handle.
 * @returns Reusable prepared statements for bulk or repeated inserts.
 */
export function prepareNodeChildrenInserts(db: Database.Database): NodeChildrenInsertStatements {
  return {
    insertFile: db.prepare(
      `INSERT INTO node_files (node_id, path, ord) VALUES (?, ?, ?)`,
    ),
    insertTag: db.prepare(`INSERT INTO node_tags (node_id, tag) VALUES (?, ?)`),
    insertTech: db.prepare(`INSERT INTO node_tech (node_id, tech) VALUES (?, ?)`),
  };
}

/**
 * Delete all child rows (files, tags, tech) for a node.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param nodeId - Node whose child rows should be removed.
 */
export function deleteNodeChildren(db: Database.Database, nodeId: string): void {
  db.prepare(`DELETE FROM node_files WHERE node_id = ?`).run(nodeId);
  db.prepare(`DELETE FROM node_tags WHERE node_id = ?`).run(nodeId);
  db.prepare(`DELETE FROM node_tech WHERE node_id = ?`).run(nodeId);
}

/**
 * Insert files, tags, and tech rows for a node using pre-prepared statements.
 *
 * @param stmts - Prepared INSERT statements from {@link prepareNodeChildrenInserts}.
 * @param nodeId - Parent node ID.
 * @param children - Child collections to insert; omitted arrays are skipped.
 */
export function insertNodeChildren(
  stmts: NodeChildrenInsertStatements,
  nodeId: string,
  children: NodeChildrenInput,
): void {
  children.files?.forEach((filePath, ord) => {
    stmts.insertFile.run(nodeId, filePath, ord);
  });
  for (const tag of children.tags ?? []) {
    stmts.insertTag.run(nodeId, tag);
  }
  for (const tech of children.tech ?? []) {
    stmts.insertTech.run(nodeId, tech);
  }
}
