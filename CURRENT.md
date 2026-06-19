# Current State

**Status:** Pre-development — monorepo bootstrapping in progress
**Version target:** v0.1 (MVP)
**Package manager:** pnpm workspaces (not initialized yet)

## What exists
- Project definition (`PROJECT.md`) — authoritative source of truth for scope and specs
- Contributing guide (`CONTRIBUTING.md`) — style, workflow, and development setup
- Cursor rules (`.cursor/rules/archnaut.mdc`) — agent context fully configured
- `.gitignore` — runtime files excluded, `archnaut.json` tracked
- Minimal npm placeholder (`package.json`, `README.md`, `index.js`) — to be replaced by pnpm monorepo
- No packages yet — no `packages/`, no daemon, no MCP server

## Monorepo structure to create
```
packages/
  cli/           # Commander.js — archnaut init/start/stop/status/scan
  daemon/        # Self-daemonizing process manager
  mcp-server/    # MCP server + read/write tools
  mcp-shim/      # Thin stdio-to-HTTP proxy
  web-ui/        # React + Vite SPA
  rules-engine/  # AI tool config file generator
  shared/        # Shared TypeScript types + archnaut.json schema
```

## Recommended build order
1. `shared` — TypeScript types, archnaut.json schema, normalization logic
2. `mcp-server` — core server + all MCP tools (no UI dependency)
3. `daemon` — process lifecycle management
4. `cli` — wires together daemon + mcp-server + rules-engine
5. `rules-engine` — generates tool config files at init time
6. `web-ui` — React Flow diagram, served by CLI daemon

## Next immediate step
Initialize pnpm workspace root:
```sh
pnpm init
# add to package.json: "workspaces": ["packages/*"]
# create pnpm-workspace.yaml
# create packages/shared with tsconfig and package.json
```

## Open decisions
- None blocking v0.1. All tech decisions are locked in `PROJECT.md` and `.cursor/rules/archnaut.mdc`.
