# Current State

**Status:** `@archnaut/server` v0.1 implemented (MCP read tools complete)
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
- SQLite projection (`migrateDb`, `initDbFromFile`, `rebuildDbFromFile`, `getArchitectureSnapshot`)
- `loadValidateNormalize` / `persistArchitecture` pipeline service
- 27 vitest tests passing; `pnpm build` succeeds

### `packages/server` (`@archnaut/server`) — runtime store + HTTP + MCP read tools
- `createStore(archJsonPath, options?)` → opens SQLite at `.archnaut/db.sqlite` (or `:memory:` in tests), migrates schema, hydrates from `archnaut.json` if present
- `createHttpServer(store)` / `startServer(store, port)` — single-port Node `http` server
- `GET /health` → `{ ok: true, uptime: number }`
- `POST /api/mcp` — MCP Streamable HTTP transport (`@modelcontextprotocol/sdk`)
  - `getarchitecture` — returns full `ArchnautFileV1` snapshot as JSON
  - `getcomponentcontext(id)` — returns node + its edges + open concerns
  - `getplannedfeatures` — returns all `status: "planned"` nodes and their edges
- DNS rebinding protection on `/api/mcp` (Host + Origin allowlist)
- Request body hardening: 1 MiB size limit, empty body 400, malformed JSON 400
- Structured error logging on MCP handler failures (TODO: wire to package logger)
- 20 vitest tests passing (MCP read tools + DNS rebinding + HTTP regression); `pnpm build` succeeds

## Not yet built

- MCP **write tools** (`cleararchitecture`, `addnode`, `addedge`, `setnodemetadata`, `flagconcern`, `begin_task`, `complete_task`, `markimplemented`, `updatearchitecture`)
- `packages/cli` (`archnaut init/start/stop/status/scan`)
- `packages/web` (React + Vite SPA, React Flow diagram)
- `packages/mcp-shim` (stdio-to-HTTP proxy for tools requiring subprocess transport)
- `packages/templates` (skill, rules, hooks templates)
- Dogfooding `archnaut.json` in this repo

## Next immediate step

Implement MCP write tools in `packages/server`:

**Stateless mutation tools** (no schema changes needed):
- `cleararchitecture` — wipe runtime DB projection
- `addnode` — insert or upsert a node
- `addedge` — insert or upsert an edge
- `setnodemetadata` — update description, tech, layer, files, tags on an existing node
- `flagconcern` — append a concern

**Task lifecycle tools** (requires new `tasks` table in SQLite schema):
- `begin_task` — declare task, soft-claim target nodes, return task context
- `complete_task` — validate, transition planned → implemented, persist `archnaut.json`
- `markimplemented` — low-level single-node implementation helper (used by web UI)
- `updatearchitecture` — informational; instructs developer to re-run the scan skill

After implementing these tools, proceed to `packages/cli` (daemon fork, `archnaut start/stop/status/init`).