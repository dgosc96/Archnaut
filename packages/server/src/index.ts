/**
 * `@archnaut/server` — HTTP surface and runtime store for the Archnaut daemon.
 *
 * {@link createStore} opens the SQLite projection and hydrates from `archnaut.json`.
 * {@link createHttpServer} and {@link startServer} expose the single-port HTTP API
 * (health check today; MCP and static UI routes attach here as the server grows).
 */
export {
  createHttpServer,
  startServer,
  type HealthResponse,
  type NotFoundResponse,
} from "./http.js";
export { createMcpServer, createMcpTransport } from "./mcp/index.js";
export { createStore, SingleStoreError, type Store, type CreateStoreOptions } from "./store.js";
