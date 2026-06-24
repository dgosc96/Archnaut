import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { Store } from "./store.js";

export interface HealthResponse {
  ok: true;
  uptime: number;
}

export interface NotFoundResponse {
  error: "Not Found";
}

function parsePathname(url: string | undefined): string {
  return new URL(url ?? "/", "http://127.0.0.1").pathname;
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: HealthResponse | NotFoundResponse,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

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

export function createHttpServer(store: Store): Server {
  return createServer((req, res) => handleRequest(store, req, res));
}

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
