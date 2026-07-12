import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson } from "../http.js";
import type { RouteAdapter } from "../runtime-host.js";

/** Marker for built-in health adapter deduplication in {@link RuntimeHost.serve}. */
export const HEALTH_ADAPTER_KIND = "health" as const;

/**
 * Built-in route adapter for `GET /health`.
 *
 * @returns Route adapter that returns `{ ok: true, uptime }`.
 */
export function createHealthAdapter(): RouteAdapter & { readonly kind: typeof HEALTH_ADAPTER_KIND } {
  return {
    kind: HEALTH_ADAPTER_KIND,
    match(method: string, pathname: string): boolean {
      return method === "GET" && pathname === "/health";
    },
    handle(_req: IncomingMessage, res: ServerResponse): void {
      sendJson(res, 200, { ok: true, uptime: process.uptime() });
    },
  };
}
