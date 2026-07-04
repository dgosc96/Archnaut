import type Database from "better-sqlite3";

const ARCHITECTURE_DDL = `
CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root TEXT NOT NULL,
  package_manager TEXT,
  monorepo INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  tags_json TEXT
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  layer TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS node_files (
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  ord INTEGER NOT NULL,
  PRIMARY KEY (node_id, path)
);

CREATE TABLE IF NOT EXISTS node_tags (
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (node_id, tag)
);

CREATE TABLE IF NOT EXISTS node_tech (
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  tech TEXT NOT NULL,
  PRIMARY KEY (node_id, tech)
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES nodes(id),
  to_id TEXT NOT NULL REFERENCES nodes(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS concerns (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress','completed','abandoned')),
  parent_task_id TEXT REFERENCES tasks(id),
  metadata_json TEXT,
  notes TEXT,
  planned_feature_ids_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_target_nodes (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  PRIMARY KEY (task_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_task_target_nodes_node ON task_target_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_updated ON tasks(status, updated_at);
`;

/**
 * Ensure the SQLite projection schema exists on an open database connection.
 *
 * @param db - Open better-sqlite3 database handle.
 */
export function migrateDb(db: Database.Database): void {
  db.exec(ARCHITECTURE_DDL);
}

/**
 * Delete architecture projection rows without dropping schema or runtime task tables.
 *
 * @param db - Open better-sqlite3 database handle.
 *
 * @remarks Called at the start of {@link initDbFromFile} so hydration replaces the
 * git-tracked projection while preserving runtime-only task lifecycle state.
 */
export function clearArchitectureProjection(db: Database.Database): void {
  db.exec(`
    DELETE FROM node_files;
    DELETE FROM node_tags;
    DELETE FROM node_tech;
    DELETE FROM edges;
    DELETE FROM nodes;
    DELETE FROM concerns;
    DELETE FROM workspaces;
    DELETE FROM project;
    DELETE FROM meta;
  `);
}

/**
 * Delete all runtime task rows.
 *
 * @param db - Open better-sqlite3 database handle.
 */
export function clearTasks(db: Database.Database): void {
  db.exec(`
    DELETE FROM task_target_nodes;
    DELETE FROM tasks;
  `);
}

/**
 * Delete all rows from every table without dropping schema.
 *
 * @param db - Open better-sqlite3 database handle.
 */
export function clearDb(db: Database.Database): void {
  clearArchitectureProjection(db);
  clearTasks(db);
}

/**
 * Delete graph projection rows (nodes, edges, concerns) while keeping project metadata.
 *
 * @param db - Open better-sqlite3 database handle.
 *
 * @remarks Used by `cleararchitecture` before a rescan so `project`, `workspaces`, and `meta`
 * remain available for subsequent `addnode` / `persistArchitecture` calls.
 */
export function clearNodesAndEdges(db: Database.Database): void {
  db.exec(`
    DELETE FROM node_files;
    DELETE FROM node_tags;
    DELETE FROM node_tech;
    DELETE FROM edges;
    DELETE FROM nodes;
    DELETE FROM concerns;
  `);
}
