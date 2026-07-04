import type Database from "better-sqlite3";

import { stableJsonEqual } from "../json/sort-object-keys.js";

export type TaskStatus = "in_progress" | "completed" | "abandoned";

/** Input for inserting a new in-progress task. */
export type InsertTaskInput = {
  id: string;
  agentId: string;
  summary: string;
  targetNodeIds: string[];
  parentTaskId?: string;
  plannedFeatureIds?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

/** Full task row including junction target nodes. */
export type TaskRecord = {
  id: string;
  agentId: string;
  summary: string;
  status: TaskStatus;
  targetNodeIds: string[];
  parentTaskId?: string;
  plannedFeatureIds?: string[];
  metadata?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/** Payload fields compared for begin_task idempotency. */
export type TaskPayload = {
  agentId: string;
  summary: string;
  targetNodeIds: string[];
  parentTaskId?: string;
  plannedFeatureIds?: string[];
  metadata?: Record<string, unknown>;
};

/** Inactivity threshold before overlapping tasks are auto-abandoned on begin_task. */
export const TASK_STALE_MS = 24 * 60 * 60 * 1000;

type TaskRow = {
  id: string;
  agent_id: string;
  summary: string;
  status: TaskStatus;
  parent_task_id: string | null;
  metadata_json: string | null;
  notes: string | null;
  planned_feature_ids_json: string | null;
  created_at: string;
  updated_at: string;
};

function parseJsonArray(value: string | null): string[] | undefined {
  if (value === null) return undefined;
  return JSON.parse(value) as string[];
}

function parseMetadata(value: string | null): Record<string, unknown> | undefined {
  if (value === null) return undefined;
  return JSON.parse(value) as Record<string, unknown>;
}

function rowToTask(row: TaskRow, targetNodeIds: string[]): TaskRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    summary: row.summary,
    status: row.status,
    targetNodeIds,
    parentTaskId: row.parent_task_id ?? undefined,
    plannedFeatureIds: parseJsonArray(row.planned_feature_ids_json),
    metadata: parseMetadata(row.metadata_json),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function loadTargetNodeIds(db: Database.Database, taskId: string): string[] {
  return (
    db
      .prepare(`SELECT node_id FROM task_target_nodes WHERE task_id = ? ORDER BY node_id`)
      .all(taskId) as Array<{ node_id: string }>
  ).map((r) => r.node_id);
}

function sortedUnique(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function metadataEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  return stableJsonEqual(a ?? null, b ?? null);
}

/**
 * Return whether an existing task matches a begin_task payload for idempotent retry.
 *
 * @param task - Existing task record from the database.
 * @param payload - Incoming begin_task fields to compare.
 * @returns `true` when all compared fields match (target/planned ids compared in sorted order).
 */
export function taskPayloadMatches(task: TaskRecord, payload: TaskPayload): boolean {
  return (
    task.agentId === payload.agentId &&
    task.summary === payload.summary &&
    arraysEqual(sortedUnique(task.targetNodeIds), sortedUnique(payload.targetNodeIds)) &&
    (task.parentTaskId ?? undefined) === (payload.parentTaskId ?? undefined) &&
    arraysEqual(
      sortedUnique(task.plannedFeatureIds ?? []),
      sortedUnique(payload.plannedFeatureIds ?? []),
    ) &&
    metadataEqual(task.metadata, payload.metadata)
  );
}

/**
 * Load a task by ID, including target node IDs.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param taskId - Task ID to load.
 * @returns Task record, or `null` when no row exists.
 */
export function getTask(db: Database.Database, taskId: string): TaskRecord | null {
  const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId) as TaskRow | undefined;
  if (!row) return null;
  return rowToTask(row, loadTargetNodeIds(db, taskId));
}

/**
 * Insert a new in-progress task and its target-node claims.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param input - Task fields and target node IDs to persist.
 */
export function insertTask(db: Database.Database, input: InsertTaskInput): void {
  const insertTaskStmt = db.prepare(`
    INSERT INTO tasks (
      id, agent_id, summary, status, parent_task_id, metadata_json,
      planned_feature_ids_json, created_at, updated_at
    ) VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?, ?)
  `);
  const insertTarget = db.prepare(`
    INSERT INTO task_target_nodes (task_id, node_id) VALUES (?, ?)
  `);

  const run = db.transaction(() => {
    insertTaskStmt.run(
      input.id,
      input.agentId,
      input.summary,
      input.parentTaskId ?? null,
      input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
      input.plannedFeatureIds !== undefined ? JSON.stringify(input.plannedFeatureIds) : null,
      input.createdAt,
      input.updatedAt,
    );
    for (const nodeId of sortedUnique(input.targetNodeIds)) {
      insertTarget.run(input.id, nodeId);
    }
  });

  run();
}

function findTasksOverlappingNodes(
  db: Database.Database,
  nodeIds: string[],
  options: { excludeTaskId?: string; staleBefore?: string },
): TaskRecord[] {
  if (nodeIds.length === 0) return [];

  const unique = sortedUnique(nodeIds);
  const placeholders = unique.map(() => "?").join(", ");
  const params: string[] = [...unique];

  let sql = `
    SELECT DISTINCT t.* FROM tasks t
    INNER JOIN task_target_nodes ttn ON ttn.task_id = t.id
    WHERE t.status = 'in_progress'
      AND ttn.node_id IN (${placeholders})
  `;

  if (options.excludeTaskId) {
    sql += ` AND t.id != ?`;
    params.push(options.excludeTaskId);
  }
  if (options.staleBefore) {
    sql += ` AND t.updated_at < ?`;
    params.push(options.staleBefore);
  }

  sql += ` ORDER BY t.id`;

  const rows = db.prepare(sql).all(...params) as TaskRow[];
  if (rows.length === 0) return [];
  const taskIds = rows.map((r) => r.id);
  const targetPlaceholders = taskIds.map(() => "?").join(", ");
  const targetRows = db
    .prepare(
      `SELECT task_id, node_id FROM task_target_nodes WHERE task_id IN (${targetPlaceholders}) ORDER BY node_id`,
    )
    .all(...taskIds) as Array<{ task_id: string; node_id: string }>;
  const targetsByTask = new Map<string, string[]>();
  for (const r of targetRows) {
    const arr = targetsByTask.get(r.task_id) ?? [];
    arr.push(r.node_id);
    targetsByTask.set(r.task_id, arr);
  }
  return rows.map((row) => rowToTask(row, targetsByTask.get(row.id) ?? []));
}

/**
 * Find in-progress tasks whose claims intersect the given node IDs.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param nodeIds - Node IDs to check for overlapping claims.
 * @param excludeTaskId - Optional task ID to omit from results.
 * @returns Matching in-progress tasks, sorted by task ID.
 */
export function findOverlappingActiveTasks(
  db: Database.Database,
  nodeIds: string[],
  excludeTaskId?: string,
): TaskRecord[] {
  return findTasksOverlappingNodes(db, nodeIds, { excludeTaskId });
}

/**
 * Find in-progress tasks with overlapping claims older than the stale cutoff.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param nodeIds - Node IDs to check for overlapping claims.
 * @param staleBeforeIso - ISO timestamp; tasks with `updated_at` before this are stale.
 * @param excludeTaskId - Optional task ID to omit from results.
 * @returns Stale in-progress tasks with overlapping claims, sorted by task ID.
 */
export function findStaleOverlappingTasks(
  db: Database.Database,
  nodeIds: string[],
  staleBeforeIso: string,
  excludeTaskId?: string,
): TaskRecord[] {
  return findTasksOverlappingNodes(db, nodeIds, { excludeTaskId, staleBefore: staleBeforeIso });
}

/**
 * Mark a task as abandoned and bump updated_at.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param taskId - Task ID to abandon.
 * @param updatedAt - ISO timestamp written to `updated_at`.
 * @throws When the task does not exist.
 */
export function abandonTask(db: Database.Database, taskId: string, updatedAt: string): void {
  const result = db
    .prepare(
      `UPDATE tasks SET status = 'abandoned', updated_at = ? WHERE id = ? AND status = 'in_progress'`,
    )
    .run(updatedAt, taskId);
  if (result.changes === 0) {
    throw new Error(`Task '${taskId}' not found`);
  }
}

/**
 * Finalize a task with completed or abandoned status and optional notes.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param taskId - Task ID to finalize.
 * @param status - Terminal status (`completed` or `abandoned`).
 * @param updatedAt - ISO timestamp written to `updated_at`.
 * @param notes - Optional completion or abandonment notes.
 * @throws When the task does not exist.
 */
export function completeTaskRecord(
  db: Database.Database,
  taskId: string,
  status: "completed" | "abandoned",
  updatedAt: string,
  notes?: string,
): void {
  const result = db
    .prepare(`UPDATE tasks SET status = ?, notes = ?, updated_at = ? WHERE id = ?`)
    .run(status, notes ?? null, updatedAt, taskId);
  if (result.changes === 0) {
    throw new Error(`Task '${taskId}' not found`);
  }
}
