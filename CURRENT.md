# Current State

**Status:** `@archnaut/core` v0.1 implemented
**Version target:** v0.1 (MVP)
**Package manager:** pnpm workspaces (initialized)

## What exists

- Project definition (`PROJECT.md`), contributing guide, Cursor rules
- **pnpm monorepo** root with `pnpm-workspace.yaml` and `.npmrc` (`allow-build=better-sqlite3`)
- **`packages/core` (`@archnaut/core`)** — full v0.1 domain layer:
  - Zod schemas + inferred TypeScript types for `archnaut.json` v1
  - Collect-all validation with cross-field checks
  - Deterministic normalization + stable JSON serialization
  - Semantic ID parse/generate helpers
  - Atomic `archnaut.json` repository (load/save)
  - SQLite projection (`migrateDb`, `initDbFromFile`, `rebuildDbFromFile`, `getArchitectureSnapshot`)
  - `loadValidateNormalize` / `persistArchitecture` pipeline service
  - 27 vitest tests passing; `pnpm build` succeeds

## Not yet built

- `packages/server` (MCP + HTTP + daemon)
- `packages/cli` (`archnaut init/start/stop/status/scan`)
- `packages/web`, `packages/mcp-shim`, `packages/templates`
- Dogfooding `archnaut.json` in this repo

## Next immediate step

Implement `packages/server` or bootstrap `packages/cli` to wire daemon lifecycle and MCP tools against `@archnaut/core`.

