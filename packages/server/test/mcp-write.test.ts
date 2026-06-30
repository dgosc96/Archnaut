import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import {
  getArchitectureSnapshot,
  initDbFromFile,
  saveArchnautFile,
  type ArchnautFileV1,
} from "@archnaut/core";
import { afterEach, describe, expect, it } from "vitest";

import { startServer } from "../src/http.js";
import { createStore, type Store } from "../src/store.js";

const SEED_FILE: ArchnautFileV1 = {
  version: 1,
  project: { id: "proj.test", name: "Test Project", root: ".", monorepo: false },
  workspaces: [{ id: "ws.api", name: "api", path: "apps/api", kind: "app" }],
  nodes: [
    { id: "cmp.api", name: "API", kind: "component", status: "implemented", files: ["src/api.ts"] },
    { id: "cmp.ui", name: "UI", kind: "component", status: "planned", files: [] },
  ],
  edges: [{ id: "edge.ui-api", from: "cmp.ui", to: "cmp.api", type: "calls", status: "planned" }],
  concerns: [],
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "archnaut-mcp-write-"));
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

async function expectStoreUnchanged(
  s: Store,
  before: ArchnautFileV1,
  jsonBefore: string,
): Promise<void> {
  const after = getArchitectureSnapshot(s.getDb());
  expect(after).toEqual(before);
  expect(await readFile(s.getArchJsonPath(), "utf8")).toBe(jsonBefore);
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

describe("MCP write tools", () => {
  it("cleararchitecture returns { cleared: true } on seeded store", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "cleararchitecture");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{ cleared: boolean }>(body);
    expect(isError).toBe(false);
    expect(parsed).toEqual({ cleared: true });
  });

  it("cleararchitecture leaves valid empty-graph snapshot", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "cleararchitecture");

    const res = await callTool(port, "getarchitecture");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<ArchnautFileV1>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected architecture JSON");
    expect(parsed.project.id).toBe("proj.test");
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.edges).toHaveLength(0);
    expect(parsed.concerns).toHaveLength(0);
  });

  it("cleararchitecture persists cleared graph to archnaut.json", async () => {
    store = await makeStore();
    seedStore(store);
    await saveArchnautFile(store.getArchJsonPath(), SEED_FILE);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "cleararchitecture");

    const raw = await readFile(store.getArchJsonPath(), "utf8");
    const file = JSON.parse(raw) as ArchnautFileV1;
    expect(file.nodes).toHaveLength(0);
    expect(file.edges).toHaveLength(0);
    expect(file.concerns).toHaveLength(0);
    expect(file.project.id).toBe("proj.test");
  });

  it("addnode inserts a new node", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const addRes = await callTool(port, "addnode", {
      id: "cmp.db",
      name: "Database",
      kind: "database",
      status: "planned",
    });
    expect(addRes.status).toBe(200);
    const addBody = (await addRes.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed: addParsed, isError: addError } = parseToolResult<{ id: string; upserted: boolean }>(
      addBody,
    );
    expect(addError).toBe(false);
    expect(addParsed).toEqual({ id: "cmp.db", upserted: true });

    const res = await callTool(port, "getarchitecture");
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<ArchnautFileV1>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected architecture JSON");
    expect(parsed.nodes.some((n) => n.id === "cmp.db")).toBe(true);
  });

  it("addnode replaces an existing node", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "addnode", {
      id: "cmp.api",
      name: "API v2",
      kind: "component",
      status: "implemented",
    });

    const res = await callTool(port, "getarchitecture");
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<ArchnautFileV1>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected architecture JSON");
    const node = parsed.nodes.find((n) => n.id === "cmp.api");
    expect(node?.name).toBe("API v2");
  });

  it("addnode persists to archnaut.json on disk", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "addnode", {
      id: "cmp.db",
      name: "Database",
      kind: "database",
      status: "planned",
    });

    const raw = await readFile(store.getArchJsonPath(), "utf8");
    const file = JSON.parse(raw) as ArchnautFileV1;
    expect(file.nodes.some((n) => n.id === "cmp.db")).toBe(true);
  });

  it("addnode returns error for unknown workspaceId", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "addnode", {
      id: "cmp.new",
      name: "New",
      kind: "component",
      status: "planned",
      workspaceId: "ws.missing",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError, text } = parseToolResult(body);
    expect(isError).toBe(true);
    expect(text).toMatch(/not found/i);
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("addedge inserts a new edge", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "addnode", {
      id: "cmp.db",
      name: "Database",
      kind: "database",
      status: "planned",
    });

    const addRes = await callTool(port, "addedge", {
      id: "edge.api-db",
      from: "cmp.api",
      to: "cmp.db",
      type: "reads_writes",
      status: "planned",
    });
    expect(addRes.status).toBe(200);
    const addBody = (await addRes.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{ id: string; upserted: boolean }>(addBody);
    expect(isError).toBe(false);
    expect(parsed).toEqual({ id: "edge.api-db", upserted: true });

    const res = await callTool(port, "getarchitecture");
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed: arch, isError: archError } = parseToolResult<ArchnautFileV1>(body);
    expect(archError).toBe(false);
    if (arch === null) throw new Error("expected architecture JSON");
    expect(arch.edges.some((e) => e.id === "edge.api-db")).toBe(true);
  });

  it("addedge persists to archnaut.json on disk", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "addnode", {
      id: "cmp.db",
      name: "Database",
      kind: "database",
      status: "planned",
    });

    await callTool(port, "addedge", {
      id: "edge.api-db",
      from: "cmp.api",
      to: "cmp.db",
      type: "reads_writes",
      status: "planned",
    });

    const raw = await readFile(store.getArchJsonPath(), "utf8");
    const file = JSON.parse(raw) as ArchnautFileV1;
    const edge = file.edges.find((e) => e.id === "edge.api-db");
    expect(edge).toEqual({
      id: "edge.api-db",
      from: "cmp.api",
      to: "cmp.db",
      type: "reads_writes",
      status: "planned",
    });
  });

  it("addedge returns error when from node does not exist", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "addedge", {
      id: "edge.ghost-api",
      from: "cmp.ghost",
      to: "cmp.api",
      type: "calls",
      status: "planned",
    });

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError } = parseToolResult(body);
    expect(isError).toBe(true);
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("addedge returns error when to node does not exist", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "addedge", {
      id: "edge.api-ghost",
      from: "cmp.api",
      to: "cmp.ghost",
      type: "calls",
      status: "planned",
    });

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError } = parseToolResult(body);
    expect(isError).toBe(true);
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("setnodemetadata updates node status", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "setnodemetadata", { id: "cmp.ui", status: "implemented" });

    const res = await callTool(port, "getarchitecture");
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<ArchnautFileV1>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected architecture JSON");
    const node = parsed.nodes.find((n) => n.id === "cmp.ui");
    expect(node?.status).toBe("implemented");
  });

  it("setnodemetadata persists to archnaut.json on disk", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "setnodemetadata", { id: "cmp.ui", status: "implemented" });

    const raw = await readFile(store.getArchJsonPath(), "utf8");
    const file = JSON.parse(raw) as ArchnautFileV1;
    const node = file.nodes.find((n) => n.id === "cmp.ui");
    expect(node?.status).toBe("implemented");
  });

  it("setnodemetadata updates node name", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "setnodemetadata", { id: "cmp.api", name: "API Service" });

    const res = await callTool(port, "getarchitecture");
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<ArchnautFileV1>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected architecture JSON");
    const node = parsed.nodes.find((n) => n.id === "cmp.api");
    expect(node?.name).toBe("API Service");
  });

  it("setnodemetadata updates files array", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "setnodemetadata", { id: "cmp.ui", files: ["src/ui.tsx"] });

    const res = await callTool(port, "getarchitecture");
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<ArchnautFileV1>(body);
    expect(isError).toBe(false);
    if (parsed === null) throw new Error("expected architecture JSON");
    const node = parsed.nodes.find((n) => n.id === "cmp.ui");
    expect(node?.files).toEqual(["src/ui.tsx"]);
  });

  it("setnodemetadata returns error for unknown node", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "setnodemetadata", { id: "cmp.ghost", name: "Ghost" });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError, text } = parseToolResult(body);
    expect(isError).toBe(true);
    expect(text).toMatch(/not found/i);
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("flagconcern creates a concern", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const flagRes = await callTool(port, "flagconcern", {
      scope: "cmp.api",
      severity: "medium",
      description: "Needs auth",
    });
    const flagBody = (await flagRes.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed: flagParsed, isError: flagError } = parseToolResult<{
      id: string;
      created: boolean;
    }>(flagBody);
    expect(flagError).toBe(false);
    expect(flagParsed?.created).toBe(true);
    expect(flagParsed?.id).toMatch(/^concern\./);

    const ctxRes = await callTool(port, "getcomponentcontext", { id: "cmp.api" });
    const ctxBody = (await ctxRes.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed: ctx, isError: ctxError } = parseToolResult<{
      concerns: Array<{ description: string }>;
    }>(ctxBody);
    expect(ctxError).toBe(false);
    if (ctx === null) throw new Error("expected component context");
    expect(ctx.concerns.some((c) => c.description === "Needs auth")).toBe(true);
  });

  it("flagconcern persists to archnaut.json on disk", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "flagconcern", {
      scope: "cmp.api",
      severity: "low",
      description: "Disk concern",
    });

    const raw = await readFile(store.getArchJsonPath(), "utf8");
    const file = JSON.parse(raw) as ArchnautFileV1;
    expect(file.concerns.some((c) => c.description === "Disk concern")).toBe(true);
  });

  it("flagconcern returns error when scope node does not exist", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "flagconcern", {
      scope: "cmp.missing",
      severity: "high",
      description: "Orphan concern",
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError } = parseToolResult(body);
    expect(isError).toBe(true);
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("addnode rolls back DB and leaves archnaut.json unchanged when persist fails", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    const jsonPath = store.getArchJsonPath();
    await saveArchnautFile(jsonPath, before);
    const jsonBefore = await readFile(jsonPath, "utf8");
    const badJsonPath = path.join(path.dirname(jsonPath), "missing-parent", "archnaut.json");

    const blockedStore = {
      getDb: () => store!.getDb(),
      getArchJsonPath: () => badJsonPath,
    };
    server = await startServer(blockedStore, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "addnode", {
      id: "cmp.db",
      name: "Database",
      kind: "database",
      status: "planned",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError } = parseToolResult(body);
    expect(isError).toBe(true);

    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("GET /health still returns 200 after write tools registered", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
