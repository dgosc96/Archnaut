# Current State

**Status:** `@archnaut/server` v0.1 MCP read + stateless write tools complete
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
- SQLite projection (`migrateDb`, `initDbFromFile`, `rebuildDbFromFile`, `getArchitectureSnapshot`, `clearNodesAndEdges`)
- DB mutation primitives (`upsertNode`, `upsertEdge`, `patchNode`, `insertConcern`, existence checks)
- `loadValidateNormalize` / `persistArchitecture` / `applyArchitectureMutation` pipeline service (serialized mutations with DB + file rollback)
- 50 vitest tests passing; `pnpm build` succeeds

### `packages/server` (`@archnaut/server`) — runtime store + HTTP + MCP read/write tools

- `createStore(archJsonPath, options?)` → opens SQLite at `.archnaut/db.sqlite` (or `:memory:` in tests), migrates schema, hydrates from `archnaut.json` if present
- `createHttpServer(store)` / `startServer(store, port)` — single-port Node `http` server
- `GET /health` → `{ ok: true, uptime: number }`
- `POST /api/mcp` — MCP Streamable HTTP transport (`@modelcontextprotocol/sdk`); MCP code split into `src/mcp/` (`http.ts`, `responses.ts`, `tools.ts`, `index.ts`)
- **Read tools:**
  - `getarchitecture` — returns full `ArchnautFileV1` snapshot as JSON
  - `getcomponentcontext(id)` — returns node + its edges + open concerns
  - `getplannedfeatures` — returns all `status: "planned"` nodes and their edges
- **Write tools** (mutate SQLite, persist to `archnaut.json` via `applyArchitectureMutation`):
  - `cleararchitecture` — wipe nodes/edges/concerns; keep project/workspaces/meta
  - `addnode` — insert or full-replace a node
  - `addedge` — insert or full-replace an edge
  - `setnodemetadata` — partial update on an existing node
  - `flagconcern` — append an architectural concern
- DNS rebinding protection on `/api/mcp` (Host + Origin allowlist)
- Request body hardening: 1 MiB size limit (413 Payload Too Large), empty body 400, malformed JSON 400
- Structured error logging on MCP handler failures (TODO: wire to package logger)
- 46 vitest tests passing (MCP read + write tools + DNS rebinding + HTTP regression); `pnpm build` succeeds

## Not yet built

- MCP **task lifecycle tools** (`begin_task`, `complete_task`, `markimplemented`, `updatearchitecture`) — requires new `tasks` table in SQLite schema
- `packages/cli` (`archnaut init/start/stop/status/scan`)
- `packages/web` (React + Vite SPA, React Flow diagram)
- `packages/mcp-shim` (stdio-to-HTTP proxy for tools requiring subprocess transport)
- `packages/templates` (skill, rules, hooks templates)
- Dogfooding `archnaut.json` in this repo

## Next immediate step

Implement MCP task lifecycle tools in `packages/server`:

- `begin_task` — declare task, soft-claim target nodes, return task context
- `complete_task` — validate, transition planned → implemented, persist `archnaut.json`
- `markimplemented` — low-level single-node implementation helper (used by web UI)
- `updatearchitecture` — informational; instructs developer to re-run the scan skill

These require a new `tasks` table in the SQLite schema (`packages/core/src/db/migrate.ts`).

After task lifecycle tools, proceed to `packages/cli` (daemon fork, `archnaut start/stop/status/init`).
