# Current State

**Status:** `@archnaut/server` v0.1 MCP read + write + task lifecycle tools complete
**Version target:** v0.1 (MVP)
**Package manager:** pnpm workspaces

## What exists

- Project definition (`PROJECT.md`), contributing guide, Cursor rules
- **pnpm monorepo** root with `pnpm-workspace.yaml` and `.npmrc` (`allow-build=better-sqlite3`)

### `packages/core` (`@archnaut/core`) — full v0.1 domain layer

- Zod schemas + inferred TypeScript types for `archnaut.json` v1
- Collect-all validation with cross-field checks
- Deterministic normalization + stable JSON serialization
- Semantic ID parse/generate helpers
- Atomic `archnaut.json` repository (load/save)
- SQLite projection (`migrateDb`, `initDbFromFile`, `rebuildDbFromFile`, `getArchitectureSnapshot`, `clearArchitectureProjection`, `clearNodesAndEdges`)
- Runtime-only **tasks** tables (`tasks`, `task_target_nodes`) — preserved across `initDbFromFile` / architecture persist
- DB mutation primitives (`upsertNode`, `upsertEdge`, `patchNode`, `patchEdge`, `insertConcern`, existence/status helpers)
- Task DB primitives (`insertTask`, `getTask`, overlap/stale queries, `abandonTask`, `completeTaskRecord`, `taskPayloadMatches`)
- `loadValidateNormalize` / `persistArchitecture` / `applyArchitectureMutation` / `applyTaskMutation` pipeline service (serialized mutations; bootstrap file persist on empty DB; DB rollback + byte-accurate file restore on failure)
- `readArchitectureSnapshot` — reads under the same lock as mutations
- `EmptyArchitectureError` — thrown when DB has no project row (empty/uninitialized projection)
- 64 vitest tests passing; `pnpm build` succeeds

### `packages/server` (`@archnaut/server`) — runtime store + HTTP + MCP tools

- `createStore(archJsonPath, options?)` → opens SQLite at `.archnaut/db.sqlite` (or `:memory:` in tests), migrates schema, hydrates from `archnaut.json` if present
- `createHttpServer(store)` / `startServer(store, port)` — single-port Node `http` server
- `GET /health` → `{ ok: true, uptime: number }`
- `POST /api/mcp` — MCP Streamable HTTP transport (`@modelcontextprotocol/sdk`); MCP code split into `src/mcp/` (`http.ts`, `responses.ts`, `tools.ts`, `task-tools.ts`, `index.ts`)
- **Read tools:**
  - `getarchitecture` — returns full `ArchnautFileV1` snapshot as JSON
  - `getcomponentcontext(id)` — returns node + its edges + open concerns
  - `getplannedfeatures` — returns all `status: "planned"` nodes and their edges
  - Empty DB returns MCP `isError` with scan-skill guidance (`EmptyArchitectureError` mapped in `tryGetSnapshot`)
- **Write tools** (mutate SQLite, persist to `archnaut.json` via `applyArchitectureMutation`; validation runs inside the mutation lock):
  - `cleararchitecture` — wipe nodes/edges/concerns; keep project/workspaces/meta
  - `addnode` — insert or full-replace a node
  - `addedge` — insert or full-replace an edge
  - `setnodemetadata` — partial update on an existing node
  - `flagconcern` — append an architectural concern
- **Task lifecycle tools** (tasks SQLite-only; graph changes persist via `applyArchitectureMutation`):
  - `begin_task` — soft-claim `targetNodeIds`, stale overlap auto-abandon (24h), overlap warnings + medium concerns, idempotent retry
  - `complete_task` — finalize task; optional `implementedNodeIds`/`implementedEdgeIds`; auto-concerns for out-of-claim / empty files / abandoned planned nodes
  - `markimplemented` — single-node `planned` → `implemented` (idempotent no-op if already implemented)
  - `updatearchitecture` — read-only rescan guidance (no DB/file mutation)
- MCP tool annotations on all registered tools (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- DNS rebinding protection on `/api/mcp` (Host + Origin allowlist)
- Request body hardening: 1 MiB size limit (413 Payload Too Large), empty body 400, malformed JSON 400
- Structured error logging on MCP handler failures (TODO: wire to package logger)
- 62 vitest tests passing (MCP read + write + task lifecycle + DNS rebinding + HTTP regression); `pnpm build` succeeds

## Not yet built

- `packages/cli` (`archnaut init/start/stop/status/scan`)
- `packages/web-ui` (React + Vite SPA, React Flow diagram)
- `packages/mcp-shim` (stdio-to-HTTP proxy for tools requiring subprocess transport)
- `packages/rules-engine` (skill, rules, hooks templates)
- Dogfooding `archnaut.json` in this repo
- `getactivetasks` read tool (post-v0.1 follow-up)

## Next immediate step

Proceed to `packages/cli` (daemon fork, `archnaut start/stop/status/init`).
