import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createHttpServer, startServer } from "../src/http.js";
import { createStore, type Store } from "../src/store.js";

const tempDirs: string[] = [];
let server: Server | undefined;
let store: Store | undefined;

afterEach(async () => {
  if (server) {
    await closeServer(server);
    server = undefined;
  }
  if (store) {
    store.getDb().close();
    store = undefined;
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "archnaut-http-"));
  tempDirs.push(dir);
  return dir;
}

async function makeStore(): Promise<Store> {
  const dir = await makeTempDir();
  const jsonPath = path.join(dir, "archnaut.json");
  return createStore(jsonPath, { dbPath: ":memory:" });
}

function getServerPort(srv: Server): number {
  const addr = srv.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return addr.port;
}

async function closeServer(srv: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    srv.close((err) => (err ? reject(err) : resolve())),
  );
}

/** Send a raw HTTP/1.1 GET with an arbitrary request-target (for malformed URL cases). */
async function rawGet(port: number, requestTarget: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const client = net.connect(port, "127.0.0.1", () => {
      client.write(
        `GET ${requestTarget} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`,
      );
    });
    let data = "";
    client.on("data", (chunk) => {
      data += chunk.toString();
    });
    client.on("close", () => {
      const [head, ...rest] = data.split("\r\n\r\n");
      const statusLine = head.split("\r\n")[0] ?? "";
      const statusCode = Number(statusLine.split(" ")[1]);
      resolve({ statusCode, body: rest.join("\r\n\r\n") });
    });
    client.on("error", reject);
  });
}

describe("http server", () => {
  it("startServer resolves when listening", async () => {
    store = await makeStore();
    server = await startServer(store, 0);
    expect(server.listening).toBe(true);
  });

  it("GET /health returns 200 JSON", async () => {
    store = await makeStore();
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = (await res.json()) as { ok: boolean; uptime: number };
    expect(body).toEqual({ ok: true, uptime: expect.any(Number) });
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("GET /does-not-exist returns 404 JSON", async () => {
    store = await makeStore();
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await fetch(`http://127.0.0.1:${port}/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  it("returns 404 for malformed request-target without crashing", async () => {
    store = await makeStore();
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const { statusCode, body } = await rawGet(port, "http://[::1");
    expect(statusCode).toBe(404);
    expect(JSON.parse(body)).toEqual({ error: "Not Found" });
  });

  it("createHttpServer listens without startServer", async () => {
    store = await makeStore();
    server = createHttpServer(store);
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, () => resolve());
    });
    const port = getServerPort(server);

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, uptime: expect.any(Number) });
  });
});
