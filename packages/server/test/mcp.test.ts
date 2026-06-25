import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { clearDb, initDbFromFile, type ArchnautFileV1, type Concern, type Edge, type Node } from "@archnaut/core";
import { afterEach, describe, expect, it } from "vitest";

import { startServer } from "../src/http.js";
import { createStore, type Store } from "../src/store.js";

const SEED_FILE: ArchnautFileV1 = {
  version: 1,
  project: { id: "proj.test", name: "Test Project", root: ".", monorepo: false },
  workspaces: [],
  nodes: [
    { id: "cmp.api", name: "API", kind: "component", status: "implemented", files: [] },
    { id: "cmp.ui", name: "UI", kind: "component", status: "planned", files: [] },
  ],
  edges: [{ id: "edge.ui-api", from: "cmp.ui", to: "cmp.api", type: "calls", status: "planned" }],
  concerns: [
    {
      id: "concern.1",
      scope: "cmp.api",
      severity: "medium",
      status: "open",
      source: "human",
      description: "Needs auth.",
    },
  ],
  meta: {},
};

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "archnaut-mcp-"));
  tempDirs.push(dir);
  return dir;
}

async function makeStore(): Promise<Store> {
  const dir = await makeTempDir();
  const jsonPath = path.join(dir, "archnaut.json");
  return createStore(jsonPath, { dbPath: ":memory:" });
}

function seedStore(s: Store): void {
  initDbFromFile(SEED_FILE, s.getDb());
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

async function callTool(port: number, toolName: string, args: Record<string, unknown> = {}) {
  return fetch(`http://127.0.0.1:${port}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });
}

function parseToolResult<T>(body: {
  result?: { content?: Array<{ text?: string }>; isError?: boolean };
}): { parsed: T | null; isError: boolean; text: string } {
  const text = body.result?.content?.[0]?.text ?? "";
  let parsed: T | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      parsed = null;
    }
  }
  return {
    parsed,
    isError: body.result?.isError ?? false,
    text,
  };
}

describe("MCP read tools", () => {
  it("getarchitecture returns HTTP 200 on unseeded store", async () => {
    store = await makeStore();
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "getarchitecture");
    expect(res.status).toBe(200);
  });

  it("getarchitecture returns full snapshot when seeded", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "getarchitecture");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<ArchnautFileV1>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected architecture JSON");
    expect(parsed.project.id).toBe("proj.test");
    expect(parsed.nodes).toHaveLength(2);
  });

  it("getarchitecture returns isError on empty DB", async () => {
    store = await makeStore();
    clearDb(store.getDb());
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "getarchitecture");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError, text } = parseToolResult(body);
    expect(isError).toBe(true);
    expect(text).toMatch(/Architecture is empty/i);
  });

  it("getcomponentcontext returns node, edges, and concerns for known id", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "getcomponentcontext", { id: "cmp.api" });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{
      node: Node;
      edges: Edge[];
      concerns: Concern[];
    }>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected component context JSON");
    expect(parsed.node.id).toBe("cmp.api");
    expect(parsed.edges.some((e) => e.id === "edge.ui-api")).toBe(true);
    expect(parsed.concerns.some((c) => c.id === "concern.1")).toBe(true);
  });

  it("getcomponentcontext returns isError for unknown id", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "getcomponentcontext", { id: "cmp.missing" });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError, text } = parseToolResult(body);
    expect(isError).toBe(true);
    expect(text).toMatch(/not found/i);
  });

  it("getplannedfeatures returns planned nodes and related edges", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "getplannedfeatures");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{
      nodes: Node[];
      edges: Edge[];
      total: number;
    }>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected planned features JSON");
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]!.id).toBe("cmp.ui");
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.total).toBe(1);
  });

  it("handles concurrent MCP tool calls without cross-talk", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const [archRes, ctxRes, plannedRes] = await Promise.all([
      callTool(port, "getarchitecture"),
      callTool(port, "getcomponentcontext", { id: "cmp.api" }),
      callTool(port, "getplannedfeatures"),
    ]);

    expect(archRes.status).toBe(200);
    expect(ctxRes.status).toBe(200);
    expect(plannedRes.status).toBe(200);

    const archBody = (await archRes.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed: arch, isError: archError } = parseToolResult<ArchnautFileV1>(archBody);
    expect(archError).toBe(false);
    if (arch === null) throw new Error("expected architecture JSON");
    expect(arch.project.id).toBe("proj.test");

    const ctxBody = (await ctxRes.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed: ctx, isError: ctxError } = parseToolResult<{ node: Node }>(ctxBody);
    expect(ctxError).toBe(false);
    if (ctx === null) throw new Error("expected component context JSON");
    expect(ctx.node.id).toBe("cmp.api");

    const plannedBody = (await plannedRes.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed: planned, isError: plannedError } = parseToolResult<{
      nodes: Node[];
      total: number;
    }>(plannedBody);
    expect(plannedError).toBe(false);
    if (planned === null) throw new Error("expected planned features JSON");
    expect(planned.total).toBe(1);
    expect(planned.nodes[0]!.id).toBe("cmp.ui");
  });

  it("GET /health still returns 200 after MCP wiring", async () => {
    store = await makeStore();
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, uptime: expect.any(Number) });
  });
});
