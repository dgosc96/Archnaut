import type { IncomingMessage, ServerResponse } from "node:http";

import { getArchitectureSnapshot, type ArchnautFileV1 } from "@archnaut/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import type { Store } from "./store.js";

type SnapshotResult =
  | ArchnautFileV1
  | { isError: true; message: string };

const EMPTY_ARCHITECTURE_ERROR = "Database has no project row";

function tryGetSnapshot(store: Store): SnapshotResult {
  try {
    return getArchitectureSnapshot(store.getDb());
  } catch (error) {
    if (error instanceof Error && error.message === EMPTY_ARCHITECTURE_ERROR) {
      return {
        isError: true,
        message:
          "Architecture is empty. Run the scan skill in your AI tool to populate it.",
      };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      message: `Failed to read architecture snapshot: ${detail}`,
    };
  }
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Maximum MCP request body size (1 MiB). */
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

class RequestBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestBodyError";
  }
}

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += buf.length;
    if (size > MAX_REQUEST_BODY_BYTES) {
      req.resume();
      throw new RequestBodyError("Request body too large");
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new RequestBodyError("Malformed JSON body");
  }
}

/**
 * Set a request header on both `headers` and `rawHeaders` so downstream parsers see it.
 *
 * @param req - Incoming HTTP request to mutate.
 * @param name - Header field name (e.g. `accept`).
 * @param value - Header field value.
 */
function setRequestHeader(req: IncomingMessage, name: string, value: string): void {
  const lower = name.toLowerCase();
  req.headers[lower] = value;

  const raw = req.rawHeaders;
  for (let i = 0; i < raw.length; i += 2) {
    if (raw[i]?.toLowerCase() === lower) {
      raw[i + 1] = value;
      return;
    }
  }
  raw.push(name, value);
}

function ensureMcpAcceptHeaders(req: IncomingMessage): void {
  const accept = req.headers.accept ?? "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    setRequestHeader(req, "accept", "application/json, text/event-stream");
  }
}

/**
 * Build the long-lived MCP server with read-only architecture tools.
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

/**
 * Create a stateless Streamable HTTP transport for a single MCP request.
 *
 * @returns Transport configured for JSON responses without session IDs.
 */
export function createMcpTransport(): StreamableHTTPServerTransport {
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
}

function errorFields(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "UnknownError", message: String(err) };
}

/**
 * Handle one MCP HTTP request with an isolated server and transport.
 *
 * Creates fresh `McpServer` and transport instances per request (stateless mode),
 * connects them, delegates to the transport, and closes both on response end.
 *
 * @param store - Runtime store for architecture tool handlers.
 * @param req - Incoming HTTP request.
 * @param res - HTTP response to complete.
 */
export async function handleMcpRequest(
  store: Store,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const mcpServer = createMcpServer(store);
  const transport = createMcpTransport();

  res.on("close", () => {
    void transport.close();
    void mcpServer.close();
  });

  try {
    ensureMcpAcceptHeaders(req);
    const body = await readRequestBody(req);
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    if (!res.headersSent) {
      if (error instanceof RequestBodyError) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Bad Request" }));
        return;
      }
      // TODO: route through the package's structured logger
      console.error(
        JSON.stringify({
          msg: "MCP request handling failed",
          err: errorFields(error),
        }),
      );
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
}
