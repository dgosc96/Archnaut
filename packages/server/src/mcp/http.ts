import type { IncomingMessage, ServerResponse } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import type { Store } from "../store.js";
import { createMcpServer } from "./tools.js";

/** Maximum MCP request body size (1 MiB). */
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

class RequestBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestBodyError";
  }
}

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "RequestBodyTooLargeError";
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
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) throw new RequestBodyError("Empty request body");
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

/** Localhost hostnames permitted for MCP (DNS rebinding protection). */
const ALLOWED_MCP_HOSTNAMES = ["localhost", "127.0.0.1", "::1"] as const;

function parseHostHeader(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;
  try {
    return new URL(`http://${hostHeader}`).hostname;
  } catch {
    return null;
  }
}

function normalizeHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function isAllowedMcpHostname(hostname: string): boolean {
  return (ALLOWED_MCP_HOSTNAMES as readonly string[]).includes(normalizeHostname(hostname));
}

/**
 * Validate Host and Origin headers against localhost allowlist (DNS rebinding protection).
 *
 * @param req - Incoming HTTP request to validate.
 * @returns Error message when validation fails, otherwise `undefined`.
 */
function validateMcpDnsRebinding(req: IncomingMessage): string | undefined {
  const hostHeader = req.headers.host;
  const hostname = parseHostHeader(hostHeader);
  if (!hostname || !isAllowedMcpHostname(hostname)) {
    return `Invalid Host header: ${hostHeader ?? "(missing)"}`;
  }

  const originHeader = req.headers.origin;
  if (originHeader) {
    try {
      const originHostname = new URL(originHeader).hostname;
      if (!isAllowedMcpHostname(originHostname)) {
        return `Invalid Origin header: ${originHeader}`;
      }
    } catch {
      return `Invalid Origin header: ${originHeader}`;
    }
  }

  return undefined;
}

function sendMcpForbidden(res: ServerResponse, message: string): void {
  res.statusCode = 403;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32_000, message },
      id: null,
    }),
  );
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
    const rebindingError = validateMcpDnsRebinding(req);
    if (rebindingError) {
      sendMcpForbidden(res, rebindingError);
      return;
    }

    ensureMcpAcceptHeaders(req);
    const body = await readRequestBody(req);
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    if (!res.headersSent) {
      if (error instanceof RequestBodyTooLargeError) {
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Payload Too Large" }));
        return;
      }
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
