import type { Server } from "node:http";

import type { Store } from "./store.js";

const HTTP_DRAIN_MS = 5_000;

/**
 * Gracefully stop the HTTP server and close the runtime store.
 *
 * Drains active connections with a 5s budget, then force-closes remaining sockets.
 * Always closes the store after HTTP shutdown.
 *
 * @param server - Listening Node HTTP server.
 * @param store - Runtime store to close after HTTP drain.
 */
export async function shutdownServer(server: Server, store: Store): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      server.closeAllConnections();
      resolve();
    }, HTTP_DRAIN_MS);

    server.close((err) => {
      clearTimeout(timeout);
      if (err) {
        console.error("HTTP server close error:", err);
      }
      resolve();
    });
  });

  store.close();
}
