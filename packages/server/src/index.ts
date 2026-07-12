/**
 * `@archnaut/server` — HTTP surface and runtime store for the Archnaut daemon.
 *
 * {@link createStore} opens the SQLite projection and hydrates from `archnaut.json`.
 * {@link RuntimeHost} owns project open → HTTP serve → graceful close.
 */
export {
  RuntimeHost,
  registerGracefulShutdown,
  type OpenOptions,
  type RouteAdapter,
  type RouteContext,
  type ServeOptions,
} from "./runtime-host.js";
export { createMcpServer, createMcpTransport } from "./mcp/index.js";
export { createStore, SingleStoreError, type Store, type CreateStoreOptions } from "./store.js";
