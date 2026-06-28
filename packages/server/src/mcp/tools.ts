import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { Store } from "../store.js";
import { errorResult, jsonResult, tryGetSnapshot } from "./responses.js";

/**
 * Build the MCP server with architecture read tools.
 *
 * @param store - Runtime store for SQLite projection access.
 * @returns Configured MCP server instance (no transport attached).
 */
export function createMcpServer(store: Store): McpServer {
  const server = new McpServer({ name: "archnaut", version: "0.1.0" });

  server.registerTool(
    "getarchitecture",
    {
      description: "Return the full architecture graph as structured JSON.",
      inputSchema: {},
    },
    async () => {
      const snapshot = tryGetSnapshot(store);
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
    },
    async ({ id }) => {
      const snapshot = tryGetSnapshot(store);
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
    },
    async () => {
      const snapshot = tryGetSnapshot(store);
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

  return server;
}
