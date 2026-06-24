import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { Store } from "./store.js";

/** JSON body returned by `GET /health`. */
export interface HealthResponse {
  ok: true;
  uptime: number;
}

/** JSON body returned for unknown routes. */
export interface NotFoundResponse {
  error: "Not Found";
}

/** Fallback pathname when `url` cannot be parsed; routes to 404. */
const UNPARSEABLE_PATH = "";

/**
 * Extract the pathname from a request URL, ignoring query strings.
 *
 * @param url - Raw request URL from `IncomingMessage`.
 * @returns Pathname, or empty string when parsing fails (routes to 404).
 */
function parsePathname(url: string | undefined): string {
  try {
    return new URL(url ?? "/", "http://127.0.0.1").pathname;
  } catch {
    return UNPARSEABLE_PATH;
  }
}

/**
 * Write a JSON response with the given HTTP status.
 *
 * @param res - Node HTTP response to write to.
 * @param status - HTTP status code.
 * @param body - JSON-serializable response body.
 */
function sendJson(
  res: ServerResponse,
  status: number,
  body: HealthResponse | NotFoundResponse,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/**
 * Route incoming HTTP requests to handlers or return 404.
 *
 * @param _store - Runtime store (reserved for future MCP/architecture routes).
 * @param req - Incoming HTTP request.
 * @param res - HTTP response to complete.
 */
function handleRequest(
  _store: Store,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const method = req.method ?? "GET";
  const pathname = parsePathname(req.url);

  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true, uptime: process.uptime() });
    return;
  }

  sendJson(res, 404, { error: "Not Found" });
}

/**
 * Create an HTTP server wired to Archnaut routing.
 * Does not call `listen`; the caller owns server lifecycle.
 *
 * @param store - Runtime store passed into request handlers.
 * @returns Node HTTP server instance (not yet listening).
 */
export function createHttpServer(store: Store): Server {
  return createServer((req, res) => handleRequest(store, req, res));
}

/**
 * Start the HTTP server on `port`.
 * Resolves when the server is listening; rejects on bind errors.
 *
 * @param store - Runtime store wired into request handling.
 * @param port - TCP port to bind (Archnaut default deployment uses 7070).
 * @returns Promise that resolves to the listening server.
 * @throws When the port is already in use (`EADDRINUSE`) or the OS denies the bind.
 */
export function startServer(store: Store, port: number): Promise<Server> {
  const server = createHttpServer(store);
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}
