import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import * as core from "@archnaut/core";
import {
  clearNodesAndEdges,
  getArchitectureSnapshot,
  getTask,
  initDbFromFile,
  insertTask,
  patchNode,
  saveArchnautFile,
  TASK_STALE_MS,
  type ArchnautFileV1,
} from "@archnaut/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startServer } from "../src/http.js";
import * as responses from "../src/mcp/responses.js";
import { createStore, type Store } from "../src/store.js";

const SEED_FILE: ArchnautFileV1 = {
  version: 1,
  project: { id: "proj.test", name: "Test Project", root: ".", monorepo: false },
  workspaces: [{ id: "ws.api", name: "api", path: "apps/api", kind: "app" }],
  nodes: [
    { id: "cmp.api", name: "API", kind: "component", status: "implemented", files: ["src/api.ts"] },
    { id: "cmp.ui", name: "UI", kind: "component", status: "planned", files: [] },
    { id: "cmp.db", name: "Database", kind: "database", status: "planned", files: [] },
  ],
  edges: [
    { id: "edge.ui-api", from: "cmp.ui", to: "cmp.api", type: "calls", status: "planned" },
    { id: "edge.api-db", from: "cmp.api", to: "cmp.db", type: "reads_writes", status: "planned" },
  ],
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "archnaut-mcp-task-"));
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

async function expectStoreUnchanged(
  s: Store,
  before: ArchnautFileV1,
  jsonBefore: string,
): Promise<void> {
  const after = getArchitectureSnapshot(s.getDb());
  expect(after).toEqual(before);
  expect(await readFile(s.getArchJsonPath(), "utf8")).toBe(jsonBefore);
}

/** Simulates cleararchitecture winning the race before the locked mutation callback runs. */
function simulateClearBeforeLockedMutation(): () => void {
  const original = core.applyArchitectureMutation;
  const spy = vi.spyOn(core, "applyArchitectureMutation").mockImplementation(
    async (archPath, db, mutate) => {
      clearNodesAndEdges(db);
      return original(archPath, db, mutate);
    },
  );
  return () => spy.mockRestore();
}

/** Simulates cleararchitecture winning the race before a task-only locked mutation runs. */
function simulateClearBeforeTaskMutation(): () => void {
  const original = core.applyTaskMutation;
  const spy = vi.spyOn(core, "applyTaskMutation").mockImplementation(async (db, mutate) => {
    clearNodesAndEdges(db);
    return original(db, mutate);
  });
  return () => spy.mockRestore();
}

describe("MCP task lifecycle tools", () => {
  it("begin_task success creates task and returns context", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "begin_task", {
      taskId: "task.ui",
      agentId: "agent-1",
      summary: "Build UI",
      targetNodeIds: ["cmp.ui"],
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{
      ok: boolean;
      taskId: string;
      status: string;
      claimedNodeIds: string[];
      context: { targetNodes: Array<{ id: string }> };
    }>(body);

    expect(isError).toBe(false);
    expect(parsed?.taskId).toBe("task.ui");
    expect(parsed?.status).toBe("in_progress");
    expect(parsed?.claimedNodeIds).toEqual(["cmp.ui"]);
    expect(parsed?.context.targetNodes[0]?.id).toBe("cmp.ui");
    expect(getTask(store.getDb(), "task.ui")?.status).toBe("in_progress");
  });

  it("begin_task returns error for unknown node without persisting task", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "begin_task", {
      taskId: "task.bad",
      agentId: "agent-1",
      summary: "Bad",
      targetNodeIds: ["cmp.missing"],
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError, text } = parseToolResult(body);
    expect(isError).toBe(true);
    expect(text).toMatch(/not found/i);
    expect(getTask(store.getDb(), "task.bad")).toBeNull();
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("begin_task overlapping active task returns warnings and medium concern", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "begin_task", {
      taskId: "task.first",
      agentId: "agent-1",
      summary: "First",
      targetNodeIds: ["cmp.ui"],
    });

    const res = await callTool(port, "begin_task", {
      taskId: "task.second",
      agentId: "agent-2",
      summary: "Second",
      targetNodeIds: ["cmp.ui"],
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{ warnings: string[] }>(body);
    expect(isError).toBe(false);
    expect(parsed?.warnings.some((w) => w.includes("task.first"))).toBe(true);

    const snapshot = getArchitectureSnapshot(store.getDb());
    expect(
      snapshot.concerns.some(
        (c) => c.severity === "medium" && c.scope === "cmp.ui" && c.source === "agent",
      ),
    ).toBe(true);
  });

  it("begin_task auto-abandons stale overlapping task", async () => {
    store = await makeStore();
    seedStore(store);
    const staleAt = new Date(Date.now() - TASK_STALE_MS - 60_000).toISOString();
    insertTask(store.getDb(), {
      id: "task.stale",
      agentId: "agent-old",
      summary: "Stale",
      targetNodeIds: ["cmp.api", "cmp.ui"],
      createdAt: staleAt,
      updatedAt: staleAt,
    });
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "begin_task", {
      taskId: "task.new",
      agentId: "agent-new",
      summary: "New claim",
      targetNodeIds: ["cmp.ui"],
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{ warnings: string[] }>(body);
    expect(isError).toBe(false);
    expect(parsed?.warnings).toEqual([]);
    expect(getTask(store.getDb(), "task.stale")?.status).toBe("abandoned");
    expect(getTask(store.getDb(), "task.new")?.status).toBe("in_progress");

    const snapshot = getArchitectureSnapshot(store.getDb());
    const activeOverlapConcerns = snapshot.concerns.filter(
      (c) =>
        c.severity === "medium" &&
        c.description.includes("Overlapping active task claims on node"),
    );
    expect(activeOverlapConcerns).toEqual([]);
    const staleConcern = snapshot.concerns.find(
      (c) => c.severity === "low" && c.description.includes("task.stale"),
    );
    expect(staleConcern).toBeDefined();
    expect(staleConcern?.scope).toBe("cmp.ui");
  });

  it("begin_task warns on fresh overlap but auto-abandons stale overlap", async () => {
    store = await makeStore();
    seedStore(store);
    const staleAt = new Date(Date.now() - TASK_STALE_MS - 60_000).toISOString();
    const freshAt = new Date().toISOString();
    insertTask(store.getDb(), {
      id: "task.stale",
      agentId: "agent-old",
      summary: "Stale",
      targetNodeIds: ["cmp.ui"],
      createdAt: staleAt,
      updatedAt: staleAt,
    });
    insertTask(store.getDb(), {
      id: "task.first",
      agentId: "agent-1",
      summary: "First active",
      targetNodeIds: ["cmp.api"],
      createdAt: freshAt,
      updatedAt: freshAt,
    });
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "begin_task", {
      taskId: "task.second",
      agentId: "agent-2",
      summary: "Second active",
      targetNodeIds: ["cmp.ui", "cmp.api"],
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{ warnings: string[] }>(body);
    expect(isError).toBe(false);
    expect(getTask(store.getDb(), "task.stale")?.status).toBe("abandoned");
    expect(getTask(store.getDb(), "task.first")?.status).toBe("in_progress");
    expect(parsed?.warnings.some((w) => w.includes("task.first"))).toBe(true);
    expect(parsed?.warnings.some((w) => w.includes("task.stale"))).toBe(false);

    const snapshot = getArchitectureSnapshot(store.getDb());
    expect(
      snapshot.concerns.some(
        (c) => c.severity === "medium" && c.scope === "cmp.api" && c.source === "agent",
      ),
    ).toBe(true);
    const staleConcern = snapshot.concerns.find(
      (c) => c.severity === "low" && c.description.includes("task.stale"),
    );
    expect(staleConcern).toBeDefined();
    expect(staleConcern?.scope).toBe("cmp.ui");
  });

  it("begin_task rejects finalized taskId reuse", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "begin_task", {
      taskId: "task.done",
      agentId: "agent-1",
      summary: "Work",
      targetNodeIds: ["cmp.ui"],
    });
    await callTool(port, "complete_task", {
      taskId: "task.done",
      status: "completed",
    });

    const res = await callTool(port, "begin_task", {
      taskId: "task.done",
      agentId: "agent-1",
      summary: "Retry",
      targetNodeIds: ["cmp.ui"],
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError, text } = parseToolResult(body);
    expect(isError).toBe(true);
    expect(text).toMatch(/finalized/i);
  });

  it("begin_task idempotent retry returns fresh target node context", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const args = {
      taskId: "task.fresh-ctx",
      agentId: "agent-1",
      summary: "Fresh context",
      targetNodeIds: ["cmp.ui"],
    };
    await callTool(port, "begin_task", args);

    patchNode(store.getDb(), { id: "cmp.ui", status: "implemented" });

    const current = getArchitectureSnapshot(store.getDb());
    const staleSnapshot: ArchnautFileV1 = {
      ...current,
      nodes: current.nodes.map((n) =>
        n.id === "cmp.ui" ? { ...n, status: "planned" as const } : n,
      ),
    };
    const spy = vi.spyOn(responses, "tryGetSnapshot").mockResolvedValue(staleSnapshot);

    const res = await callTool(port, "begin_task", args);
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{
      context: { targetNodes: Array<{ id: string; status: string }> };
    }>(body);

    spy.mockRestore();
    expect(isError).toBe(false);
    expect(parsed?.context.targetNodes[0]?.status).toBe("implemented");
  });

  it("begin_task idempotent retry returns same task without duplicate row", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const args = {
      taskId: "task.idem",
      agentId: "agent-1",
      summary: "Idempotent",
      targetNodeIds: ["cmp.ui"],
    };
    await callTool(port, "begin_task", args);
    await callTool(port, "begin_task", args);

    const rows = store
      .getDb()
      .prepare(`SELECT COUNT(*) AS c FROM tasks WHERE id = ?`)
      .get("task.idem") as { c: number };
    expect(rows.c).toBe(1);
  });

  it("begin_task idempotent retry leaves archnaut.json unchanged", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const args = {
      taskId: "task.idem-json",
      agentId: "agent-1",
      summary: "Idempotent json",
      targetNodeIds: ["cmp.ui"],
    };
    await callTool(port, "begin_task", args);
    await callTool(port, "begin_task", args);

    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("begin_task idempotent retry succeeds when metadata keys are reordered", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const first = {
      taskId: "task.meta-idem",
      agentId: "agent-1",
      summary: "Metadata idempotent",
      targetNodeIds: ["cmp.ui"],
      metadata: { priority: "high", source: "agent" },
    };
    const retry = {
      ...first,
      metadata: { source: "agent", priority: "high" },
    };

    const resFirst = await callTool(port, "begin_task", first);
    const bodyFirst = (await resFirst.json()) as Parameters<typeof parseToolResult>[0];
    const { isError: isErrorFirst } = parseToolResult(bodyFirst);
    expect(isErrorFirst).toBe(false);

    const resRetry = await callTool(port, "begin_task", retry);
    const bodyRetry = (await resRetry.json()) as Parameters<typeof parseToolResult>[0];
    const { isError: isErrorRetry } = parseToolResult(bodyRetry);
    expect(isErrorRetry).toBe(false);

    const rows = store
      .getDb()
      .prepare(`SELECT COUNT(*) AS c FROM tasks WHERE id = ?`)
      .get("task.meta-idem") as { c: number };
    expect(rows.c).toBe(1);
  });

  it("begin_task concurrent identical calls do not error", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const args = {
      taskId: "task.concurrent",
      agentId: "agent-1",
      summary: "Concurrent begin",
      targetNodeIds: ["cmp.ui"],
    };

    const [resA, resB] = await Promise.all([
      callTool(port, "begin_task", args),
      callTool(port, "begin_task", args),
    ]);
    const bodyA = (await resA.json()) as Parameters<typeof parseToolResult>[0];
    const bodyB = (await resB.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed: parsedA, isError: isErrorA } = parseToolResult<{ ok: boolean }>(bodyA);
    const { parsed: parsedB, isError: isErrorB } = parseToolResult<{ ok: boolean }>(bodyB);

    expect(isErrorA).toBe(false);
    expect(isErrorB).toBe(false);
    expect(parsedA?.ok).toBe(true);
    expect(parsedB?.ok).toBe(true);

    const rows = store
      .getDb()
      .prepare(`SELECT COUNT(*) AS c FROM tasks WHERE id = ?`)
      .get("task.concurrent") as { c: number };
    expect(rows.c).toBe(1);
  });

  it("begin_task rejects target nodes cleared before locked mutation runs", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const restore = simulateClearBeforeTaskMutation();
    try {
      const res = await callTool(port, "begin_task", {
        taskId: "task.race",
        agentId: "agent-1",
        summary: "Race",
        targetNodeIds: ["cmp.ui"],
      });
      const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
      const { isError, text } = parseToolResult(body);
      expect(isError).toBe(true);
      expect(text).toMatch(/not found/i);
      expect(getTask(store.getDb(), "task.race")).toBeNull();
    } finally {
      restore();
    }
  });

  it("complete_task rejects implemented nodes cleared before locked mutation runs", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "begin_task", {
      taskId: "task.race-complete",
      agentId: "agent-1",
      summary: "Race complete",
      targetNodeIds: ["cmp.ui"],
    });

    const restore = simulateClearBeforeLockedMutation();
    try {
      const res = await callTool(port, "complete_task", {
        taskId: "task.race-complete",
        status: "completed",
        implementedNodeIds: ["cmp.ui"],
      });
      const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
      const { isError, text } = parseToolResult(body);
      expect(isError).toBe(true);
      expect(text).toMatch(/not found/i);
      expect(getTask(store.getDb(), "task.race-complete")?.status).toBe("in_progress");
    } finally {
      restore();
    }
  });

  it("complete_task marks planned nodes implemented and persists", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "begin_task", {
      taskId: "task.ui",
      agentId: "agent-1",
      summary: "UI work",
      targetNodeIds: ["cmp.ui"],
    });

    const res = await callTool(port, "complete_task", {
      taskId: "task.ui",
      status: "completed",
      implementedNodeIds: ["cmp.ui"],
      implementedEdgeIds: ["edge.ui-api"],
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{
      status: string;
      updatedNodeIds: string[];
      updatedEdgeIds: string[];
      normalized: boolean;
    }>(body);
    expect(isError).toBe(false);
    expect(parsed?.status).toBe("completed");
    expect(parsed?.updatedNodeIds).toEqual(["cmp.ui"]);
    expect(parsed?.updatedEdgeIds).toEqual(["edge.ui-api"]);
    expect(parsed?.normalized).toBe(true);

    const file = JSON.parse(await readFile(store.getArchJsonPath(), "utf8")) as ArchnautFileV1;
    expect(file.nodes.find((n) => n.id === "cmp.ui")?.status).toBe("implemented");
    expect(file.edges.find((e) => e.id === "edge.ui-api")?.status).toBe("implemented");
    expect(getTask(store.getDb(), "task.ui")?.status).toBe("completed");
  });

  it("complete_task abandoned finalizes task without persisting architecture", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "begin_task", {
      taskId: "task.abandon",
      agentId: "agent-1",
      summary: "Abandon work",
      targetNodeIds: ["cmp.ui"],
    });

    const res = await callTool(port, "complete_task", {
      taskId: "task.abandon",
      status: "abandoned",
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{ status: string }>(body);
    expect(isError).toBe(false);
    expect(parsed?.status).toBe("abandoned");
    expect(getTask(store.getDb(), "task.abandon")?.status).toBe("abandoned");
    expect(await readFile(store.getArchJsonPath(), "utf8")).toBe(jsonBefore);
  });

  it("complete_task returns error for unknown task", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "complete_task", {
      taskId: "task.missing",
      status: "completed",
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError } = parseToolResult(body);
    expect(isError).toBe(true);
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("complete_task rejects already completed task", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "begin_task", {
      taskId: "task.once",
      agentId: "agent-1",
      summary: "Once",
      targetNodeIds: ["cmp.ui"],
    });
    await callTool(port, "complete_task", { taskId: "task.once", status: "completed" });

    const res = await callTool(port, "complete_task", {
      taskId: "task.once",
      status: "completed",
    });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError, text } = parseToolResult(body);
    expect(isError).toBe(true);
    expect(text).toMatch(/not in progress/i);
  });

  it("markimplemented updates planned node and persists", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "markimplemented", { featureId: "cmp.ui" });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{
      featureId: string;
      status: string;
      updated: boolean;
    }>(body);
    expect(isError).toBe(false);
    expect(parsed).toEqual({
      ok: true,
      featureId: "cmp.ui",
      status: "implemented",
      updated: true,
    });

    const file = JSON.parse(await readFile(store.getArchJsonPath(), "utf8")) as ArchnautFileV1;
    expect(file.nodes.find((n) => n.id === "cmp.ui")?.status).toBe("implemented");
  });

  it("markimplemented returns error for unknown node", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "markimplemented", { featureId: "cmp.ghost" });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { isError } = parseToolResult(body);
    expect(isError).toBe(true);
  });

  it("markimplemented is no-op when already implemented", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "markimplemented", { featureId: "cmp.api" });
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{ updated: boolean }>(body);
    expect(isError).toBe(false);
    expect(parsed?.updated).toBe(false);
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("markimplemented rejects node cleared before locked mutation runs", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const restore = simulateClearBeforeLockedMutation();
    try {
      const res = await callTool(port, "markimplemented", { featureId: "cmp.ui" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
      const { isError, text } = parseToolResult(body);
      expect(isError).toBe(true);
      expect(text).toBe("Node 'cmp.ui' not found.");
    } finally {
      restore();
    }
  });

  it("updatearchitecture returns rescan guidance without mutation", async () => {
    store = await makeStore();
    seedStore(store);
    const before = getArchitectureSnapshot(store.getDb());
    await saveArchnautFile(store.getArchJsonPath(), before);
    const jsonBefore = await readFile(store.getArchJsonPath(), "utf8");
    server = await startServer(store, 0);
    const port = getServerPort(server);

    const res = await callTool(port, "updatearchitecture");
    const body = (await res.json()) as Parameters<typeof parseToolResult>[0];
    const { parsed, isError } = parseToolResult<{
      action: string;
      scanSkillPath: string;
    }>(body);
    expect(isError).toBe(false);
    expect(parsed?.action).toBe("rescan");
    expect(parsed?.scanSkillPath).toBe(".archnaut/skills/scan.md");
    await expectStoreUnchanged(store, before, jsonBefore);
  });

  it("tasks survive addnode persist", async () => {
    store = await makeStore();
    seedStore(store);
    server = await startServer(store, 0);
    const port = getServerPort(server);

    await callTool(port, "begin_task", {
      taskId: "task.persist",
      agentId: "agent-1",
      summary: "Persist test",
      targetNodeIds: ["cmp.ui"],
    });

    await callTool(port, "addnode", {
      id: "cmp.extra",
      name: "Extra",
      kind: "component",
      status: "planned",
    });

    expect(getTask(store.getDb(), "task.persist")?.status).toBe("in_progress");
  });
});
