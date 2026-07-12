import type { IncomingMessage, ServerResponse } from "node:http";

import { handleMcpRequest } from "../mcp/index.js";
import type { RouteAdapter, RouteContext } from "../runtime-host.js";

/** Marker for built-in MCP adapter deduplication in {@link RuntimeHost.serve}. */
export const MCP_ADAPTER_KIND = "mcp" as const;

/**
 * Built-in route adapter for `POST /api/mcp`.
 *
 * @returns Route adapter that delegates to {@link handleMcpRequest}.
 */
export function createMcpAdapter(): RouteAdapter & { readonly kind: typeof MCP_ADAPTER_KIND } {
  return {
    kind: MCP_ADAPTER_KIND,
    match(method: string, pathname: string): boolean {
      return method === "POST" && pathname === "/api/mcp";
    },
    async handle(req: IncomingMessage, res: ServerResponse, ctx: RouteContext): Promise<void> {
      await handleMcpRequest(ctx.store, req, res);
    },
  };
}
