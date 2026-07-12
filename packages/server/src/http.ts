import type { ServerResponse } from "node:http";

/** JSON body returned by `GET /health`. */
export interface HealthResponse {
  ok: true;
  uptime: number;
}

/** JSON body returned for unknown routes. */
export interface NotFoundResponse {
  error: "Not Found";
}

/** JSON body returned for unhandled server errors. */
export interface InternalErrorResponse {
  error: "Internal Server Error";
}

/** Fallback pathname when `url` cannot be parsed; routes to 404. */
const UNPARSEABLE_PATH = "";

/**
 * Extract the pathname from a request URL, ignoring query strings.
 *
 * @param url - Raw request URL from `IncomingMessage`.
 * @returns Pathname, or empty string when parsing fails (routes to 404).
 */
export function parsePathname(url: string | undefined): string {
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
export function sendJson(
  res: ServerResponse,
  status: number,
  body: HealthResponse | NotFoundResponse | InternalErrorResponse,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
