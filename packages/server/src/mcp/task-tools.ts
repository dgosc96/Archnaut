import { randomUUID } from "node:crypto";

import {
  applyArchitectureMutation,
  applyTaskMutation as applyTaskMutationLocked,
  abandonTask,
  completeTaskRecord,
  edgeExists,
  findOverlappingActiveTasks,
  findStaleOverlappingTasks,
  generateConcernId,
  getArchitectureSnapshot,
  getEdgeStatus,
  getNodeFiles,
  getNodeStatus,
  getTask,
  insertConcern,
  insertTask,
  nodeExists,
  patchEdge,
  patchNode,
  taskPayloadMatches,
  TASK_STALE_MS,
  type ArchnautFileV1,
  type Node,
  type TaskRecord,
} from "@archnaut/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { z } from "zod";

import type { Store } from "../store.js";
import { errorResult, jsonResult, tryGetSnapshot } from "./responses.js";

class NodeNotFoundError extends Error {
  constructor(nodeId: string) {
    super(`Node '${nodeId}' not found.`);
    this.name = "NodeNotFoundError";
  }
}

class EdgeNotFoundError extends Error {
  constructor(edgeId: string) {
    super(`Edge '${edgeId}' not found.`);
    this.name = "EdgeNotFoundError";
  }
}

class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task '${taskId}' not found.`);
    this.name = "TaskNotFoundError";
  }
}

class TaskFinalizedError extends Error {
  constructor(taskId: string) {
    super(`Task '${taskId}' is already finalized.`);
    this.name = "TaskFinalizedError";
  }
}

class TaskInProgressConflictError extends Error {
  constructor(taskId: string) {
    super(`Task '${taskId}' is already in progress with different parameters.`);
    this.name = "TaskInProgressConflictError";
  }
}

class TaskNotInProgressError extends Error {
  constructor(taskId: string, status: string) {
    super(`Task '${taskId}' is not in progress (status: ${status}).`);
    this.name = "TaskNotInProgressError";
  }
}

const TASK_BEGIN_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const TASK_COMPLETE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const MARK_IMPLEMENTED_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const UPDATE_ARCHITECTURE_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function utcNow(): string {
  return new Date().toISOString();
}

function validateNodesExist(db: Database.Database, nodeIds: string[]): void {
  for (const nodeId of nodeIds) {
    if (!nodeExists(db, nodeId)) {
      throw new NodeNotFoundError(nodeId);
    }
  }
}

function validateEdgesExist(db: Database.Database, edgeIds: string[]): void {
  for (const edgeId of edgeIds) {
    if (!edgeExists(db, edgeId)) {
      throw new EdgeNotFoundError(edgeId);
    }
  }
}

async function runLockedTaskMutation(
  archPath: string,
  db: Database.Database,
  validate: () => void,
  mutate: () => void,
): Promise<void> {
  await applyArchitectureMutation(archPath, db, () => {
    validate();
    mutate();
  });
}

async function applyTaskMutation(
  db: Database.Database,
  validate: () => void,
  mutate: () => void,
): Promise<void> {
  await applyTaskMutationLocked(db, () => {
    validate();
    mutate();
  });
}

function nodeSnapshots(snapshot: ArchnautFileV1, nodeIds: string[]): Node[] {
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  return nodeIds.map((id) => byId.get(id)).filter((n): n is Node => n !== undefined);
}

function buildBeginTaskResponse(
  task: TaskRecord,
  snapshot: ArchnautFileV1,
  warnings: string[],
) {
  return {
    ok: true as const,
    taskId: task.id,
    status: task.status,
    claimedNodeIds: [...task.targetNodeIds].sort((a, b) => a.localeCompare(b)),
    warnings,
    context: {
      targetNodes: nodeSnapshots(snapshot, task.targetNodeIds),
    },
  };
}

function overlappingWarnings(
  overlaps: TaskRecord[],
  claimedNodeIds: string[],
): string[] {
  const claimed = new Set(claimedNodeIds);
  const warnings: string[] = [];
  for (const other of overlaps) {
    for (const nodeId of other.targetNodeIds) {
      if (claimed.has(nodeId)) {
        warnings.push(
          `Overlapping active task '${other.id}' also claims node '${nodeId}'`,
        );
      }
    }
  }
  return warnings;
}

function firstOverlapScope(overlaps: TaskRecord[], claimedNodeIds: string[]): string | null {
  const claimed = new Set(claimedNodeIds);
  for (const other of overlaps) {
    for (const nodeId of other.targetNodeIds) {
      if (claimed.has(nodeId)) return nodeId;
    }
  }
  return null;
}

type BeginTaskInput = {
  taskId: string;
  agentId: string;
  summary: string;
  targetNodeIds: string[];
  plannedFeatureIds?: string[];
  parentTaskId?: string;
  metadata?: Record<string, unknown>;
};

async function handleBeginTask(
  _archPath: string,
  db: Database.Database,
  input: BeginTaskInput,
) {
  const allNodeIds = [
    ...input.targetNodeIds,
    ...(input.plannedFeatureIds ?? []),
  ];

  const payload = {
    agentId: input.agentId,
    summary: input.summary,
    targetNodeIds: input.targetNodeIds,
    parentTaskId: input.parentTaskId,
    plannedFeatureIds: input.plannedFeatureIds,
    metadata: input.metadata,
  };

  const now = utcNow();
  const staleBefore = new Date(Date.now() - TASK_STALE_MS).toISOString();
  let idempotentTask: TaskRecord | null = null;
  let warnings: string[] = [];

  await applyTaskMutation(
    db,
    () => validateNodesExist(db, allNodeIds),
    () => {
    const existing = getTask(db, input.taskId);
    if (existing) {
      if (existing.status === "completed" || existing.status === "abandoned") {
        throw new TaskFinalizedError(input.taskId);
      }
      if (!taskPayloadMatches(existing, payload)) {
        throw new TaskInProgressConflictError(input.taskId);
      }
      idempotentTask = existing;
      return;
    }

    const staleOverlaps = findStaleOverlappingTasks(
      db,
      input.targetNodeIds,
      staleBefore,
      input.taskId,
    );

    for (const stale of staleOverlaps) {
      abandonTask(db, stale.id, now);
      insertConcern(db, {
        id: generateConcernId(randomUUID()),
        scope: firstOverlapScope([stale], input.targetNodeIds) ?? input.targetNodeIds[0]!,
        severity: "low",
        source: "agent",
        description: `Task '${stale.id}' auto-abandoned after 24h inactivity with overlapping claim.`,
      });
    }

    const activeOverlaps = findOverlappingActiveTasks(db, input.targetNodeIds, input.taskId);
    warnings = overlappingWarnings(activeOverlaps, input.targetNodeIds);

    const overlapScope = firstOverlapScope(activeOverlaps, input.targetNodeIds);
    if (overlapScope) {
      insertConcern(db, {
        id: generateConcernId(randomUUID()),
        scope: overlapScope,
        severity: "medium",
        source: "agent",
        description: `Overlapping active task claims on node '${overlapScope}'.`,
      });
    }

    insertTask(db, {
      id: input.taskId,
      agentId: input.agentId,
      summary: input.summary,
      targetNodeIds: input.targetNodeIds,
      parentTaskId: input.parentTaskId,
      plannedFeatureIds: input.plannedFeatureIds,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    });
    },
  );

  if (idempotentTask) {
    return buildBeginTaskResponse(idempotentTask, getArchitectureSnapshot(db), []);
  }

  const task = getTask(db, input.taskId);
  if (!task) throw new Error(`Task '${input.taskId}' missing after insert`);
  return buildBeginTaskResponse(task, getArchitectureSnapshot(db), warnings);
}

type CompleteTaskInput = {
  taskId: string;
  status: "completed" | "abandoned";
  implementedNodeIds?: string[];
  implementedEdgeIds?: string[];
  notes?: string;
};

async function handleCompleteTask(
  archPath: string,
  db: Database.Database,
  input: CompleteTaskInput,
) {
  const task = getTask(db, input.taskId);
  if (!task) throw new TaskNotFoundError(input.taskId);
  if (task.status !== "in_progress") {
    throw new TaskNotInProgressError(input.taskId, task.status);
  }

  const implementedNodeIds = input.implementedNodeIds ?? [];
  const implementedEdgeIds = input.implementedEdgeIds ?? [];

  const now = utcNow();
  const createdConcernIds: string[] = [];
  const updatedNodeIds: string[] = [];
  const updatedEdgeIds: string[] = [];
  const claimed = new Set(task.targetNodeIds);

  const willPatchArchitecture =
    input.status === "completed" &&
    (implementedNodeIds.some((id) => getNodeStatus(db, id) === "planned") ||
      implementedEdgeIds.some((id) => getEdgeStatus(db, id) === "planned"));

  const validate = () => {
    validateNodesExist(db, implementedNodeIds);
    validateEdgesExist(db, implementedEdgeIds);
  };

  const mutate = () => {
    const current = getTask(db, input.taskId);
    if (!current) throw new TaskNotFoundError(input.taskId);
    if (current.status !== "in_progress") {
      throw new TaskNotInProgressError(input.taskId, current.status);
    }

    if (input.status === "completed") {
      for (const nodeId of implementedNodeIds) {
        if (!claimed.has(nodeId)) {
          const concernId = generateConcernId(randomUUID());
          createdConcernIds.push(concernId);
          insertConcern(db, {
            id: concernId,
            scope: nodeId,
            severity: "medium",
            source: "agent",
            description: `Task '${input.taskId}' implemented node '${nodeId}' outside its original claim.`,
          });
        }

        const status = getNodeStatus(db, nodeId);
        if (status === "planned") {
          patchNode(db, { id: nodeId, status: "implemented" });
          updatedNodeIds.push(nodeId);
          if (getNodeFiles(db, nodeId).length === 0) {
            const concernId = generateConcernId(randomUUID());
            createdConcernIds.push(concernId);
            insertConcern(db, {
              id: concernId,
              scope: nodeId,
              severity: "low",
              source: "agent",
              description: `Node '${nodeId}' marked implemented with no files listed.`,
            });
          }
        }
      }

      for (const edgeId of implementedEdgeIds) {
        const status = getEdgeStatus(db, edgeId);
        if (status === "planned") {
          patchEdge(db, { id: edgeId, status: "implemented" });
          updatedEdgeIds.push(edgeId);
        }
      }
    } else {
      for (const nodeId of task.targetNodeIds) {
        if (getNodeStatus(db, nodeId) === "planned") {
          const concernId = generateConcernId(randomUUID());
          createdConcernIds.push(concernId);
          insertConcern(db, {
            id: concernId,
            scope: nodeId,
            severity: "low",
            source: "agent",
            description: `Task '${input.taskId}' abandoned while node '${nodeId}' remains planned.`,
          });
        }
      }
    }

    completeTaskRecord(db, input.taskId, input.status, now, input.notes);
  };

  if (willPatchArchitecture) {
    await runLockedTaskMutation(archPath, db, validate, mutate);
  } else {
    await applyTaskMutation(db, validate, mutate);
  }

  return {
    ok: true as const,
    taskId: input.taskId,
    status: input.status,
    updatedNodeIds,
    updatedEdgeIds,
    createdConcernIds,
    normalized: true,
  };
}

async function handleMarkImplemented(
  archPath: string,
  db: Database.Database,
  featureId: string,
) {
  if (getNodeStatus(db, featureId) === "implemented") {
    await applyTaskMutation(db, () => validateNodesExist(db, [featureId]), () => {});
    return {
      ok: true as const,
      featureId,
      status: "implemented" as const,
      updated: false,
    };
  }

  await runLockedTaskMutation(
    archPath,
    db,
    () => validateNodesExist(db, [featureId]),
    () => {
      patchNode(db, { id: featureId, status: "implemented" });
    },
  );
  return {
    ok: true as const,
    featureId,
    status: "implemented" as const,
    updated: true,
  };
}

/**
 * Register MCP task lifecycle tools on the server.
 *
 * @param server - MCP server instance to register tools on.
 * @param store - Runtime store for DB access and `archnaut.json` path.
 * @remarks
 * Task tools rely on process-local mutation serialization in `@archnaut/core`. The store
 * must be opened via {@link createStore} so only one server process owns a given database.
 */
export function registerTaskTools(server: McpServer, store: Store): void {
  const db = store.getDb();
  const archPath = store.getArchJsonPath();

  server.registerTool(
    "begin_task",
    {
      description:
        "Declare an agent task start and soft-claim target architecture nodes.",
      inputSchema: {
        taskId: z.string().min(1),
        agentId: z.string().min(1),
        summary: z.string().min(1),
        targetNodeIds: z.array(z.string().min(1)).min(1),
        plannedFeatureIds: z.array(z.string().min(1)).optional(),
        parentTaskId: z.string().min(1).optional(),
        metadata: z.record(z.unknown()).optional(),
      },
      annotations: TASK_BEGIN_ANNOTATIONS,
    },
    async (input) => {
      const snapshot = await tryGetSnapshot(store);
      if ("isError" in snapshot) return errorResult(snapshot.message);

      try {
        const result = await handleBeginTask(archPath, db, input);
        return jsonResult(result);
      } catch (error) {
        if (
          error instanceof NodeNotFoundError ||
          error instanceof TaskFinalizedError ||
          error instanceof TaskInProgressConflictError
        ) {
          return errorResult(error.message);
        }
        throw error;
      }
    },
  );

  server.registerTool(
    "complete_task",
    {
      description:
        "Finalize a task as completed or abandoned; optionally mark nodes and edges implemented.",
      inputSchema: {
        taskId: z.string().min(1),
        status: z.enum(["completed", "abandoned"]),
        implementedNodeIds: z.array(z.string().min(1)).optional(),
        implementedEdgeIds: z.array(z.string().min(1)).optional(),
        notes: z.string().optional(),
      },
      annotations: TASK_COMPLETE_ANNOTATIONS,
    },
    async (input) => {
      try {
        const result = await handleCompleteTask(archPath, db, input);
        return jsonResult(result);
      } catch (error) {
        if (
          error instanceof TaskNotFoundError ||
          error instanceof TaskNotInProgressError ||
          error instanceof NodeNotFoundError ||
          error instanceof EdgeNotFoundError
        ) {
          return errorResult(error.message);
        }
        throw error;
      }
    },
  );

  server.registerTool(
    "markimplemented",
    {
      description: "Mark a single planned node as implemented.",
      inputSchema: {
        featureId: z.string().min(1).describe("Node ID to mark implemented"),
      },
      annotations: MARK_IMPLEMENTED_ANNOTATIONS,
    },
    async ({ featureId }) => {
      try {
        const result = await handleMarkImplemented(archPath, db, featureId);
        return jsonResult(result);
      } catch (error) {
        if (error instanceof NodeNotFoundError) return errorResult(error.message);
        throw error;
      }
    },
  );

  server.registerTool(
    "updatearchitecture",
    {
      description:
        "Return instructions to refresh architecture via the scan skill (no mutation).",
      inputSchema: {},
      annotations: UPDATE_ARCHITECTURE_ANNOTATIONS,
    },
    async () =>
      jsonResult({
        ok: true,
        action: "rescan",
        message:
          "To refresh architecture, run the Archnaut scan skill in your AI tool. Typical flow: updatearchitecture → cleararchitecture → addnode/addedge → complete_task.",
        scanSkillPath: ".archnaut/skills/scan.md",
      }),
  );
}
