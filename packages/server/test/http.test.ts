import net from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import type { RuntimeHost } from "../src/runtime-host.js";
import { cleanupTempDirs, openTestHost } from "./helpers/runtime-host.js";

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

describe("http server via RuntimeHost", () => {
  it("serve resolves when listening", async () => {
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

  it("GET /does-not-exist returns 404 JSON", async () => {
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
});
