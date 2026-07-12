import type { IncomingMessage, ServerResponse } from "node:http";
import net from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RuntimeHost,
  registerGracefulShutdown,
  type RouteAdapter,
} from "../src/runtime-host.js";
import { cleanupTempDirs, getTempDirs, makeTempDir, openTestHost } from "./helpers/runtime-host.js";

let host: RuntimeHost | undefined;

afterEach(async () => {
  if (host) {
    await host.close();
    host = undefined;
  }
  await cleanupTempDirs();
});

/** Send a raw HTTP/1.1 GET with an arbitrary request-target (for malformed URL cases). */
async function rawGet(port: number, requestTarget: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const client = net.connect(port, "127.0.0.1", () => {
      client.write(
        `GET ${requestTarget} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`,
      );
    });
    let data = "";
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      client.destroy();
      reject(new Error(`rawGet timed out for request-target: ${requestTarget}`));
    }, 5_000);

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };

    client.on("data", (chunk) => {
      data += chunk.toString();
    });
    client.on("close", () => {
      settle(() => {
        const [head, ...rest] = data.split("\r\n\r\n");
        const statusLine = head.split("\r\n")[0] ?? "";
        const statusCode = Number(statusLine.split(" ")[1]);
        if (!Number.isInteger(statusCode)) {
          reject(new Error(`rawGet received invalid HTTP response: "${statusLine}"`));
          return;
        }
        resolve({ statusCode, body: rest.join("\r\n\r\n") });
      });
    });
    client.on("error", (err) => {
      settle(() => reject(err));
    });
  });
}

describe("RuntimeHost", () => {
  it("open + serve resolves when listening", async () => {
    host = await openTestHost();
    expect(host.getPort()).toBeGreaterThan(0);
  });

  it("GET /health returns 200 JSON", async () => {
    host = await openTestHost();
    const port = host.getPort();

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = (await res.json()) as { ok: boolean; uptime: number };
    expect(body).toEqual({ ok: true, uptime: expect.any(Number) });
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("POST /api/mcp is routed", async () => {
    host = await openTestHost();
    const port = host.getPort();

    const res = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    expect(res.status).toBe(200);
  });

  it("GET unknown route returns 404 JSON", async () => {
    host = await openTestHost();
    const port = host.getPort();

    const res = await fetch(`http://127.0.0.1:${port}/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  it("returns 404 for malformed request-target without crashing", async () => {
    host = await openTestHost();
    const port = host.getPort();

    const { statusCode, body } = await rawGet(port, "http://[::1");
    expect(statusCode).toBe(404);
    expect(JSON.parse(body)).toEqual({ error: "Not Found" });
  });

  it("registerRoute custom adapter handles matching requests", async () => {
    const dir = await makeTempDir();
    host = await RuntimeHost.open({ projectRoot: dir, dbPath: ":memory:" });

    const customAdapter: RouteAdapter = {
      match(method, pathname) {
        return method === "GET" && pathname === "/custom";
      },
      handle(_req: IncomingMessage, res: ServerResponse) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain");
        res.end("custom");
      },
    };
    host.registerRoute(customAdapter);
    await host.serve({ port: 0 });
    const port = host.getPort();

    const res = await fetch(`http://127.0.0.1:${port}/custom`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("custom");
  });

  it("registerRoute after serve throws", async () => {
    host = await openTestHost();
    expect(() =>
      host!.registerRoute({
        match: () => false,
        handle: () => undefined,
      }),
    ).toThrow("Cannot register routes after serve()");
  });

  it("close is idempotent", async () => {
    host = await openTestHost();
    await host.close();
    await host.close();
    expect(host.getPort).toThrow();
  });

  it("serve after close throws", async () => {
    host = await openTestHost();
    await host.close();
    await expect(host.serve({ port: 0 })).rejects.toThrow("RuntimeHost is closed");
  });

  it("custom health adapter registered before serve overrides built-in", async () => {
    const dir = await makeTempDir();
    host = await RuntimeHost.open({ projectRoot: dir, dbPath: ":memory:" });
    host.registerRoute({
      match(method, pathname) {
        return method === "GET" && pathname === "/health";
      },
      handle(_req, res) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, custom: true }));
      },
    });
    await host.serve({ port: 0 });
    const port = host.getPort();

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, custom: true });
  });

  it("registerGracefulShutdown triggers clean close on signal", async () => {
    const dir = await makeTempDir();
    host = await RuntimeHost.open({ projectRoot: dir, dbPath: ":memory:" });
    await host.serve({ port: 0 });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const closeSpy = vi.spyOn(host, "close");

    registerGracefulShutdown(host);
    process.emit("SIGTERM");

    await vi.waitFor(() => {
      expect(closeSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    exitSpy.mockRestore();
    closeSpy.mockRestore();
  });

  it("exposes store accessor", async () => {
    host = await openTestHost();
    expect(host.store.getDb()).toBeDefined();
    expect(host.store.getArchJsonPath()).toContain("archnaut.json");
  });

  it("openTestHost tracks temp dirs for cleanup", async () => {
    const before = getTempDirs().length;
    host = await openTestHost();
    expect(getTempDirs().length).toBeGreaterThan(before);
  });
});
