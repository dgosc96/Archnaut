import type Database from "better-sqlite3";

/** Child row collections attached to a node. */
export type NodeChildrenInput = {
  files?: string[];
  tags?: string[];
  tech?: string[];
};

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
 * Insert files, tags, and tech rows for a node.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param nodeId - Parent node ID.
 * @param children - Child collections to insert; omitted arrays are skipped.
 */
export function insertNodeChildren(
  db: Database.Database,
  nodeId: string,
  children: NodeChildrenInput,
): void {
  const insertFile = db.prepare(
    `INSERT INTO node_files (node_id, path, ord) VALUES (?, ?, ?)`,
  );
  const insertTag = db.prepare(`INSERT INTO node_tags (node_id, tag) VALUES (?, ?)`);
  const insertTech = db.prepare(`INSERT INTO node_tech (node_id, tech) VALUES (?, ?)`);

  children.files?.forEach((filePath, ord) => {
    insertFile.run(nodeId, filePath, ord);
  });
  for (const tag of children.tags ?? []) {
    insertTag.run(nodeId, tag);
  }
  for (const tech of children.tech ?? []) {
    insertTech.run(nodeId, tech);
  }
}
