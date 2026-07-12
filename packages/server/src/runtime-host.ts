import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";

import { DEFAULT_ARCHNAUT_FILENAME } from "@archnaut/core";

import { sendJson, parsePathname } from "./http.js";
import { createHealthAdapter, HEALTH_ADAPTER_KIND } from "./routes/health-adapter.js";
import { createMcpAdapter, MCP_ADAPTER_KIND } from "./routes/mcp-adapter.js";
import { shutdownServer } from "./shutdown.js";
import { createStore, type Store } from "./store.js";

/** Options for {@link RuntimeHost.open}. */
export interface OpenOptions {
  /** Absolute project root (daemon passes `--project-root`). */
  projectRoot: string;
  /** Override DB path; default `<projectRoot>/.archnaut/db.sqlite`. Tests use `':memory:'`. */
  dbPath?: string;
}

/** Options for {@link RuntimeHost.serve}. */
export interface ServeOptions {
  port: number;
}

/** Route context passed to adapters during request handling. */
export interface RouteContext {
  readonly store: Store;
}

/**
 * HTTP route adapter registered before {@link RuntimeHost.serve}.
 * First matching adapter in registration order handles the request.
 */
export interface RouteAdapter {
  match(method: string, pathname: string): boolean;
  handle(
    req: IncomingMessage,
    res: ServerResponse,
    ctx: RouteContext,
  ): void | Promise<void>;
}

type BuiltinAdapter = RouteAdapter & { readonly kind?: string };

/**
 * Deep module owning project open → HTTP serve → graceful close.
 * CLI and daemon consume this via `run-daemon.ts`; tests exercise it directly.
 */
export class RuntimeHost {
  private readonly storeHandle: Store;
  private readonly adapters: BuiltinAdapter[] = [];
  private server: Server | undefined;
  private serving = false;
  private shuttingDown = false;
  private closePromise: Promise<void> | undefined;

  private constructor(store: Store) {
    this.storeHandle = store;
  }

  /**
   * Open the runtime store for a project root.
   *
   * @param options - Project root and optional DB path override.
   * @returns Host instance ready for route registration and serving.
   */
  static async open(options: OpenOptions): Promise<RuntimeHost> {
    const projectRoot = path.resolve(options.projectRoot);
    const archJsonPath = path.join(projectRoot, DEFAULT_ARCHNAUT_FILENAME);
    const dbPath = options.dbPath ?? path.join(projectRoot, ".archnaut", "db.sqlite");
    const store = await createStore(archJsonPath, { dbPath });
    return new RuntimeHost(store);
  }

  /**
   * Runtime store handle for MCP tools and tests.
   *
   * @returns Open SQLite projection store.
   */
  get store(): Store {
    return this.storeHandle;
  }

  /**
   * Register a route adapter. Must be called before {@link serve}.
   *
   * @param adapter - Adapter to append to the dispatch table.
   * @throws When called after the server is already listening.
   */
  registerRoute(adapter: RouteAdapter): void {
    if (this.serving) {
      throw new Error("Cannot register routes after serve()");
    }
    this.adapters.push(adapter);
  }

  /**
   * Start listening on the given port.
   * Auto-registers built-in health and MCP adapters when not already present.
   *
   * @param options - TCP port to bind (`0` for ephemeral in tests).
   */
  async serve(options: ServeOptions): Promise<void> {
    if (this.shuttingDown) {
      throw new Error("RuntimeHost is closed");
    }
    if (this.serving) {
      throw new Error("RuntimeHost is already serving");
    }

    this.ensureBuiltinAdapters();

    const server = createServer((req, res) => {
      void this.dispatch(req, res).catch((err) => this.onRequestError(err, req, res));
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        server.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(options.port);
    });

    this.server = server;
    this.serving = true;
  }

  /**
   * Bound TCP port after {@link serve}.
   *
   * @returns Ephemeral or configured listen port.
   * @throws When the host is not serving.
   */
  getPort(): number {
    if (!this.server || !this.serving) {
      throw new Error("RuntimeHost is not serving");
    }
    const addr = this.server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("RuntimeHost has no bound port");
    }
    return addr.port;
  }

  /**
   * Idempotent graceful shutdown: drain HTTP, then close the store.
   *
   * @returns Resolves when HTTP and store resources are released.
   */
  async close(): Promise<void> {
    if (this.shuttingDown) {
      return this.closePromise ?? Promise.resolve();
    }
    this.shuttingDown = true;
    this.closePromise = this.doClose();
    return this.closePromise;
  }

  private ensureBuiltinAdapters(): void {
    const hasHealth = this.adapters.some((a) => a.kind === HEALTH_ADAPTER_KIND);
    const hasMcp = this.adapters.some((a) => a.kind === MCP_ADAPTER_KIND);
    if (!hasHealth) {
      this.adapters.push(createHealthAdapter());
    }
    if (!hasMcp) {
      this.adapters.push(createMcpAdapter());
    }
  }

  private async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const pathname = parsePathname(req.url);
    const ctx: RouteContext = { store: this.storeHandle };

    for (const adapter of this.adapters) {
      if (adapter.match(method, pathname)) {
        await adapter.handle(req, res, ctx);
        return;
      }
    }

    sendJson(res, 404, { error: "Not Found" });
  }

  private onRequestError(err: unknown, _req: IncomingMessage, res: ServerResponse): void {
    if (res.headersSent) return;
    console.error("Unhandled HTTP error:", err);
    sendJson(res, 500, { error: "Internal Server Error" });
  }

  private async doClose(): Promise<void> {
    if (this.server) {
      await shutdownServer(this.server, this.storeHandle);
      this.server = undefined;
    } else {
      this.storeHandle.close();
    }
    this.serving = false;
  }
}

let gracefulShutdownRegistered = false;

/**
 * Wire SIGTERM and SIGINT to {@link RuntimeHost.close} then exit.
 *
 * @param host - Host whose resources should be released on shutdown signals.
 */
export function registerGracefulShutdown(host: RuntimeHost): void {
  if (gracefulShutdownRegistered) {
    return;
  }
  gracefulShutdownRegistered = true;

  const handler = () => {
    void host.close().then(() => process.exit(0));
  };
  process.on("SIGTERM", handler);
  process.on("SIGINT", handler);
}
