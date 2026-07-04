import { randomUUID } from "node:crypto";

import {
  applyArchitectureMutation,
  clearNodesAndEdges,
  generateConcernId,
  insertConcern,
  nodeExists,
  patchNode,
  upsertEdge,
  upsertNode,
  workspaceExists,
} from "@archnaut/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { z } from "zod";

import type { Store } from "../store.js";
import { errorResult, jsonResult, tryGetSnapshot } from "./responses.js";
import { registerTaskTools } from "./task-tools.js";

class NodeNotFoundError extends Error {
  constructor(nodeId: string) {
    super(`Node '${nodeId}' not found.`);
    this.name = "NodeNotFoundError";
  }
}

class WorkspaceNotFoundError extends Error {
  constructor(workspaceId: string) {
    super(`Workspace '${workspaceId}' not found.`);
    this.name = "WorkspaceNotFoundError";
  }
}

async function runValidatedMutation(
  archPath: string,
  db: Database.Database,
  validate: () => void,
  mutate: () => void,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await applyArchitectureMutation(archPath, db, () => {
      validate();
      mutate();
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof NodeNotFoundError || error instanceof WorkspaceNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const READ_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const UPSERT_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const CLEAR_ARCHITECTURE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const FLAG_CONCERN_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/**
 * Build the MCP server with architecture read and write tools.
 *
 * @param store - Runtime store for SQLite projection access.
 * @returns Configured MCP server instance (no transport attached).
 */
export function createMcpServer(store: Store): McpServer {
  const server = new McpServer({ name: "archnaut", version: "0.1.0" });
  const db = store.getDb();
  const archPath = store.getArchJsonPath();

  server.registerTool(
    "getarchitecture",
    {
      description: "Return the full architecture graph as structured JSON.",
      inputSchema: {},
      annotations: READ_TOOL_ANNOTATIONS,
    },
    async () => {
      const snapshot = await tryGetSnapshot(store);
      if ("isError" in snapshot) {
        return errorResult(snapshot.message);
      }
      return jsonResult(snapshot);
    },
  );

  server.registerTool(
    "getcomponentcontext",
    {
      description: "Return focused context for a single architecture node.",
      inputSchema: {
        id: z.string().min(1).describe("Node ID (e.g. cmp.api.checkout)"),
      },
      annotations: READ_TOOL_ANNOTATIONS,
    },
    async ({ id }) => {
      const snapshot = await tryGetSnapshot(store);
      if ("isError" in snapshot) {
        return errorResult(snapshot.message);
      }

      const node = snapshot.nodes.find((n) => n.id === id);
      if (!node) {
        return errorResult(`Component '${id}' not found in architecture.`);
      }

      const edges = snapshot.edges.filter((e) => e.from === id || e.to === id);
      const concerns = snapshot.concerns.filter((c) => c.scope === id);

      return jsonResult({ node, edges, concerns });
    },
  );

  server.registerTool(
    "getplannedfeatures",
    {
      description: "Return all planned (not yet implemented) components and related edges.",
      inputSchema: {},
      annotations: READ_TOOL_ANNOTATIONS,
    },
    async () => {
      const snapshot = await tryGetSnapshot(store);
      if ("isError" in snapshot) {
        return errorResult(snapshot.message);
      }

      const nodes = snapshot.nodes.filter((n) => n.status === "planned");
      const plannedIds = new Set(nodes.map((n) => n.id));
      const edges = snapshot.edges.filter(
        (e) => plannedIds.has(e.from) || plannedIds.has(e.to),
      );

      return jsonResult({ nodes, edges, total: nodes.length });
    },
  );

  server.registerTool(
    "cleararchitecture",
    {
      description:
        "Wipe the entire architecture projection. Call this before a full rescan so stale nodes and edges are not carried over.",
      inputSchema: {},
      annotations: CLEAR_ARCHITECTURE_ANNOTATIONS,
    },
    async () => {
      await applyArchitectureMutation(archPath, db, () => {
        clearNodesAndEdges(db);
      });
      return jsonResult({ cleared: true });
    },
  );

  server.registerTool(
    "addnode",
    {
      description:
        "Add or update an architecture node. If a node with the given id already exists it is replaced in full.",
      inputSchema: {
        id: z.string().min(1).describe("Semantic node ID, e.g. cmp.api.checkout"),
        name: z.string().min(1).describe("Human-readable display name"),
        kind: z.enum(["component", "database", "queue", "external"]),
        status: z.enum(["planned", "implemented"]),
        files: z.array(z.string()).default([]).describe("Relative file or directory paths"),
        workspaceId: z.string().optional().describe("Workspace ID this node belongs to"),
        layer: z.enum(["frontend", "backend", "infrastructure"]).optional(),
        tags: z.array(z.string()).optional(),
        tech: z.array(z.string()).optional(),
        description: z.string().optional().describe("Goes into node.metadata.description"),
      },
      annotations: UPSERT_TOOL_ANNOTATIONS,
    },
    async (input) => {
      const result = await runValidatedMutation(
        archPath,
        db,
        () => {
          if (input.workspaceId !== undefined && !workspaceExists(db, input.workspaceId)) {
            throw new WorkspaceNotFoundError(input.workspaceId);
          }
        },
        () =>
          upsertNode(db, {
            id: input.id,
            name: input.name,
            kind: input.kind,
            status: input.status,
            files: input.files,
            workspaceId: input.workspaceId,
            layer: input.layer,
            tags: input.tags,
            tech: input.tech,
            description: input.description,
          }),
      );
      if (!result.ok) return errorResult(result.message);
      return jsonResult({ id: input.id, upserted: true });
    },
  );

  server.registerTool(
    "addedge",
    {
      description:
        "Add or update a dependency edge between two nodes. If an edge with the given id already exists it is replaced.",
      inputSchema: {
        id: z.string().min(1).describe("Semantic edge ID, e.g. edge.ui-api-calls"),
        from: z.string().min(1).describe("Source node ID"),
        to: z.string().min(1).describe("Target node ID"),
        type: z.enum([
          "depends_on",
          "calls",
          "reads_writes",
          "publishes",
          "subscribes",
          "owns",
        ]),
        status: z.enum(["planned", "implemented"]),
        description: z.string().optional().describe("Goes into edge.metadata.description"),
      },
      annotations: UPSERT_TOOL_ANNOTATIONS,
    },
    async (input) => {
      const result = await runValidatedMutation(
        archPath,
        db,
        () => {
          if (!nodeExists(db, input.from)) throw new NodeNotFoundError(input.from);
          if (!nodeExists(db, input.to)) throw new NodeNotFoundError(input.to);
        },
        () =>
          upsertEdge(db, {
            id: input.id,
            from: input.from,
            to: input.to,
            type: input.type,
            status: input.status,
            description: input.description,
          }),
      );
      if (!result.ok) return errorResult(result.message);
      return jsonResult({ id: input.id, upserted: true });
    },
  );

  server.registerTool(
    "setnodemetadata",
    {
      description:
        "Update metadata fields on an existing node. Only provided fields are changed; others are left intact.",
      inputSchema: {
        id: z.string().min(1).describe("Node ID to update"),
        name: z.string().min(1).optional(),
        status: z.enum(["planned", "implemented"]).optional(),
        layer: z.enum(["frontend", "backend", "infrastructure"]).optional().nullable(),
        files: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        tech: z.array(z.string()).optional(),
        description: z.string().optional().nullable(),
      },
      annotations: UPSERT_TOOL_ANNOTATIONS,
    },
    async (input) => {
      const result = await runValidatedMutation(
        archPath,
        db,
        () => {
          if (!nodeExists(db, input.id)) throw new NodeNotFoundError(input.id);
        },
        () =>
          patchNode(db, {
            id: input.id,
            name: input.name,
            status: input.status,
            layer: input.layer,
            files: input.files,
            tags: input.tags,
            tech: input.tech,
            description: input.description,
          }),
      );
      if (!result.ok) return errorResult(result.message);
      return jsonResult({ id: input.id, updated: true });
    },
  );

  server.registerTool(
    "flagconcern",
    {
      description:
        "Log an architectural concern for human review. Use this when confidence is low rather than guessing.",
      inputSchema: {
        scope: z.string().min(1).describe("Node ID this concern applies to"),
        severity: z.enum(["low", "medium", "high"]),
        description: z.string().min(1),
        source: z.enum(["agent", "human"]).default("agent"),
      },
      annotations: FLAG_CONCERN_ANNOTATIONS,
    },
    async (input) => {
      const id = generateConcernId(randomUUID());
      const result = await runValidatedMutation(
        archPath,
        db,
        () => {
          if (!nodeExists(db, input.scope)) throw new NodeNotFoundError(input.scope);
        },
        () =>
          insertConcern(db, {
            id,
            scope: input.scope,
            severity: input.severity,
            source: input.source,
            description: input.description,
          }),
      );
      if (!result.ok) return errorResult(result.message);
      return jsonResult({ id, created: true });
    },
  );

  registerTaskTools(server, store);

  return server;
}
