Status: Active development (v0.1 MVP in progress). Implementation progress: see [`CURRENT.md`](CURRENT.md).
License: Apache 2.0
npm: `archnaut`
Version: `0.0.1`

# Archnaut Project Definition Document (v9)

> **How to read this document**
> Feature descriptions cover the full intended product. Each section that spans multiple versions includes an explicit **v0.1 / Later** scope table so it is always clear what is being built now versus what comes after. The [MVP Scope (v0.1)](#mvp-scope-v01) section is the authoritative list of what ships first.

---

## Overview

Archnaut is a repo-installed architecture management layer for AI-assisted software development.

It addresses a critical gap in modern agentic coding workflows: AI coding agents (Cursor, Claude Code, Codex, Antigravity, and others) operate without a shared, authoritative understanding of a project's architecture, leading to architectural drift, duplicate implementations, inconsistent patterns, and progressive code quality degradation.

The tool combines two complementary approaches found separately in the ecosystem — automated codebase knowledge extraction inspired by Graphify, and visual architecture-to-code planning inspired by Solarch — into a single, bidirectional, framework-agnostic, locally hosted system.

The defining innovation is the update loop: agents don't just read the architecture, they write back to it upon task completion, keeping the diagram synchronized with reality.

The name **Archnaut** derives from *architecture navigator* — the tool acts as a compass for both human developers and AI agents navigating a codebase.

---

## Problem Statement

Current best practices for giving AI agents architectural context rely on manually maintained text files such as `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, and per-directory `README.md` files.

These approaches share a fundamental flaw: they drift from reality as code evolves, yet agents treat them as ground truth.

The result is what practitioners call **agentic drift** — agents generate code that contradicts the actual architecture, creates duplicate implementations, or introduces anti-patterns that compound over time.

Three distinct failure modes drive this problem:

- **Context staleness** — documentation is written once and not updated as code changes
- **Agent isolation** — multiple agents working in parallel have no shared architectural state
- **No feedback loop** — agents consume architectural context but never update it, breaking the synchronization cycle

Archnaut addresses all three simultaneously.

No existing tool in the ecosystem does this as a unified, repo-installed, local-first system.

---

## Competitive Landscape


| Tool            | Strengths                                                              | What Archnaut Adds                                                        |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Graphify        | Codebase knowledge graph, 70x token reduction, 15 AI tool integrations | Bidirectional sync, design/planning mode, planned/not-implemented states  |
| Solarch         | Diagram → NestJS code, strict anti-pattern rules, real-time sync       | Framework-agnostic, repo-installed, full MCP integration                  |
| Archy AI        | Architecture schema + dependencies via MCP, risk scoring               | Local-first/no cloud, visual web UI, design planning layer                |
| AICGen          | CLI generates `CLAUDE.md` / `AGENTS.md` context files                  | Visual diagram, scanning, bidirectional update loop                       |
| Repowise        | Auto-generated wikis, dependency graphs, 9 MCP tools, self-hostable    | Block diagram UI, planned feature visualization, rules/hooks installation |
| Architect skill | Tiered context system for Claude Code, cross-IDE sync                  | Automated scanning, visual representation, multi-tool MCP server          |


Archnaut's unique position is the intersection of:

- local-first deployment
- visual block diagram UI
- design/planning mode
- bidirectional agent sync
- multi-tool MCP server
- rules/hooks auto-installation

---

## Core Features

Feature descriptions below cover the full intended product. Each subsection includes a scope table marking what ships in v0.1 and what is explicitly deferred.

### 1. CLI Installer (`archnaut init`)

A single command installs Archnaut into any project repository.

On initialization the tool:

1. **Presents an interactive multi-select prompt** asking which AI coding tools the developer uses in this project (see [AI Tool Configuration Decision](#ai-tool-configuration-decision))
2. Writes MCP server connection config into the selected AI tool config files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`, and tool-specific `mcp.json` entries) pointing at `localhost:7070/api/mcp`
3. Installs the scan skill into `.archnaut/skills/scan.md` and injects a reference into the selected tools' config files so agents know to use it
4. Instructs the developer to trigger the scan skill in their AI coding tool; the agent interprets the codebase and populates the architecture diagram through MCP write tools — no static AST parsing required, making it language-agnostic from day one
5. Generates `archnaut.json`, the canonical repo-visible architecture export artifact, with native monorepo support represented inside a single file
6. Creates a local embedded runtime database derived from `archnaut.json`; this database is not committed to git and exists only for efficient MCP queries and safe mutations
7. Installs a pre-commit git hook for architecture validation and daemon health check
8. Starts the Archnaut daemon (background process) as its final step, serving both the MCP server and the web UI on one port (default `localhost:7070`)

**CLI scope**


| Capability                                            | v0.1 | Later      |
| ----------------------------------------------------- | ---- | ---------- |
| `archnaut init` (multi-select, install, daemon start) | Yes  | —          |
| `archnaut start / stop / status / scan`               | Yes  | —          |
| `archnaut upgrade` (template diff + confirm)          | —    | Yes (v0.2) |


### 2. Local Web App / Block Diagram Visualizer

A locally hosted web application (default `localhost:7070`) provides an interactive block/node diagram of the current architecture derived from `archnaut.json` via the MCP server/runtime store.

The web UI is a pre-built React + Vite static SPA bundled inside the `archnaut` npm package. It is served by the CLI's background process using `sirv` (SPA mode) on the same port as the MCP Streamable HTTP transport, with path-based routing:

```
localhost:7070/          → sirv(dist/)   [static SPA]
localhost:7070/api/*     → MCP Streamable HTTP transport
localhost:7070/ws        → WebSocket (live diagram push)
```

No separate install is required. No version mismatch between CLI and UI is possible.

**Web UI scope**


| Capability                                                           | v0.1 | Later         |
| -------------------------------------------------------------------- | ---- | ------------- |
| Live block diagram from `archnaut.json`                              | Yes  | —             |
| Manual planned node creation via drag-and-drop                       | Yes  | —             |
| Component inspector (click node → files, dependencies, notes)        | Yes  | —             |
| Diff view (planned vs implemented overlay)                           | —    | Yes           |
| Drift alerts (visual indicators of divergence)                       | —    | Yes           |
| Large monorepo performance (`onlyRenderVisibleElements`, 500+ nodes) | —    | Yes (stretch) |


### 3. MCP Server

An embedded Model Context Protocol (MCP) server makes the architecture available as a queryable resource to any MCP-compatible AI coding tool. The server uses **Streamable HTTP transport** on `localhost:7070/api/mcp`. For tools that only support stdio transport, Archnaut installs a thin stdio shim that proxies JSON-RPC to the HTTP endpoint; the shim is stateless and cheap to spawn.

Read tools:

- `getarchitecture` — returns the full architecture graph as structured context
- `getcomponentcontext(name)` — returns focused context for a single component
- `getplannedfeatures` — returns all components marked as planned but not yet implemented

Write tools used by the scanning agent and coding agents:

- `begin_task(...)` — declares a task, target architecture region, and task ownership context
- `addnode(component)` — agent adds a discovered component to the diagram
- `addedge(from, to, type)` — agent adds a dependency relationship
- `setnodemetadata(id, metadata)` — agent enriches a node with details
- `markimplemented(featureId)` — low-level implementation-state transition helper; used by the web UI for manual confirmation and internally by the server
- `complete_task(...)` — finalizes a task and triggers validation, normalization, and planned → implemented transitions where appropriate
- `updatearchitecture` — triggers a full rescan prompt (instructs developer to re-run the scan skill)
- `flagconcern(description)` — surfaces architectural concerns for human review
- `cleararchitecture` — resets the diagram before a full rescan

Compatible with Cursor, Claude Code, Codex, Antigravity, and any tool supporting the MCP standard.

### 4. Rules, Hooks & Skills Engine

On initialization, Archnaut installs a tailored set of behavioral guidelines for the **selected** AI coding tools.

- **Rules** — architectural constraints written as tool-specific rule files; prevents agents from creating files in wrong locations, deviating from established patterns, or bypassing module boundaries
- **Skills** — reusable prompt templates that instruct agents to consult the architecture before writing code, ask clarifying questions when requirements are ambiguous, and flag potential anti-patterns; the scan skill is the primary skill used to populate and refresh the architecture diagram
- **Hooks** — git pre-commit hooks that (1) warn if the Archnaut daemon is not running, and (2) warn if `archnaut.json` has not changed in a commit that touches source files (see [Pre-Commit Hook Decision](#pre-commit-hook-decision))
- **Session handoff** — auto-generates `CURRENT.md` at the end of each agent session; a structured handoff document capturing what was done, what decisions were made, and what the next step is

**Rules/Skills/Hooks scope**


| Capability                                                    | v0.1 | Later      |
| ------------------------------------------------------------- | ---- | ---------- |
| Scan skill installed at `archnaut init`                       | Yes  | —          |
| Minimal "consult Archnaut first" rules file per selected tool | Yes  | —          |
| Pre-commit hooks (daemon warning + stale diagram warning)     | Yes  | —          |
| Session handoff (`CURRENT.md` generation)                     | Yes  | —          |
| Advanced architectural constraint rules                       | —    | Yes        |
| `archnaut upgrade` for template updates                       | —    | Yes (v0.2) |


### 5. Quality / Anti-Drift Layer

**v0.1 scope**


| Capability                                                                          | v0.1 | Later |
| ----------------------------------------------------------------------------------- | ---- | ----- |
| Architecture-first enforcement (agents prompted to read architecture before coding) | Yes  | —     |
| Concern logging (`flagconcern` MCP tool)                                            | Yes  | —     |
| Proactive questioning (skills instruct agents to ask before assuming)               | Yes  | —     |
| Token-aware context injection (focused architectural slice per agent request)       | —    | Yes   |
| Anti-pattern detection (background validation rules)                                | —    | Yes   |


---

## Initial Technical Architecture

### Component Map

- `archnaut` CLI — CLI entry point (`archnaut init`, `start`, `stop`, `status`, `scan`)
- `daemon` — self-daemonizing background process manager; forks detached child, writes PID to `.archnaut/daemon.pid`, redirects logs to `.archnaut/daemon.log`
- `@archnaut/core` (`packages/core`) — domain model, validation, normalization, SQLite projection, and mutation pipeline (`applyArchitectureMutation`)
- `@archnaut/server` (`packages/server`) — HTTP server, MCP Streamable HTTP transport, runtime store; MCP tool handlers in `src/mcp/tools.ts`, persistence delegated to `@archnaut/core`
- `mcp-shim` — thin stdio-to-HTTP proxy for tools that require stdio transport; installed by `archnaut init` when needed
- `read-tools` — `getarchitecture`, `getcomponentcontext`, etc.
- `write-tools` — `addnode`, `addedge`, `markimplemented`, etc.
- `web-ui` — local web app block diagram visualizer (pre-built React + Vite SPA, bundled inside `archnaut`)
- `diagram-engine` — interactive node/block diagram renderer (React Flow `@xyflow/react`)
- `design-mode` — drag-and-drop planned feature UI
- `diff-view` — planned vs implemented overlay *(post-v0.1)*
- `rules-engine` — generates and installs AI tool config files for selected tools
- `tool-detector` — filesystem + PATH detection used to pre-populate the `archnaut init` prompt
- `templates` — `CLAUDE.md`, `.cursorrules`, `AGENTS.md` templates
- `hooks` — git hook scripts (daemon health check + `archnaut.json` staleness warning)
- `skills` — reusable agent skill definitions; `scan.md` is the primary skill
- `sync` — watches `archnaut.json` for changes, refreshes the local DB, and pushes updates to the UI via WebSocket
- `archnaut.json` — committed repo-visible architecture export / canonical git-tracked artifact
- `local runtime DB` — uncommitted embedded SQLite database (`.archnaut/db.sqlite`) derived from `archnaut.json`, used for querying, indexing, and controlled mutation; accessed in-process via `better-sqlite3`, no network port

### Technology Decisions


| Layer          | Decision                                                             | Notes                                                                                                      |
| -------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CLI            | Node.js + Commander.js                                               | Node.js has the richest MCP SDK ecosystem                                                                  |
| Scanning       | Agent-driven via scan skill                                          | Language-agnostic; agent interprets code and writes to diagram via MCP; no AI API key required in Archnaut |
| MCP Server     | `@modelcontextprotocol/sdk` (official)                               | Standard SDK used across the ecosystem                                                                     |
| MCP Transport  | Streamable HTTP on `localhost:7070/api/mcp`                          | Persistent stateful server; stdio shim available for tools requiring subprocess transport                  |
| Web UI         | React + Vite (pre-built SPA, bundled inside `archnaut`)              | Single install, no version mismatch                                                                        |
| Static serving | `sirv` (SPA mode)                                                    | Lightweight, proven in SvelteKit and Vite Preview; ~2 kB overhead                                          |
| Diagram Engine | React Flow `@xyflow/react`                                           | Native React, HTML-rich custom nodes, drag-and-drop design mode built-in                                   |
| Auto-layout    | ELK.js (`layered` algorithm, Web Worker)                             | Best for directed dependency graphs; supports workspace subflows                                           |
| Node positions | Stored in `archnaut.json` under `meta.layout` after first ELK.js run | Diagram reopens in last known position                                                                     |
| Config format  | JSON                                                                 | `archnaut.json` chosen as machine-readable export; human-readable editing is secondary                     |
| Runtime store  | `better-sqlite3` — embedded SQLite, file-based, no network port      | Local-only, gitignored, rebuildable from `archnaut.json`                                                   |
| IPC sync       | Chokidar file watcher → WebSocket (`/ws`)                            | Keeps UI in sync with file system and runtime state                                                        |
| Process model  | Single background process, single port (`7070`)                      | MCP Streamable HTTP + static SPA + WebSocket on one port, path-based routing                               |
| Collaboration  | Single-user local only (v0.1)                                        | Git handles multi-dev sharing via `archnaut.json`; CRDT/OT is post-MVP                                     |
| Init prompt    | `@clack/prompts` multi-select                                        | Interactive tool selection with filesystem-based pre-detection                                             |


### Data Flow

`Developer → Agent (using scan skill) → MCP Server → local runtime DB → normalized archnaut.json → File Watcher → WebSocket → Web UI`

The key architectural rule is that agents do not edit the file or database directly; they call MCP tools, and the server owns validation, mutation, normalization, and persistence.

---

## Architecture Representation Decision

The architecture model is a **freeform directed graph with C4-flavored metadata**, not strict C4 as the primary schema.

This decision was made because Archnaut's main jobs are:

- bidirectional sync between code and architecture
- graph querying through MCP
- design/planning before implementation
- support for diverse codebases rather than strict diagram orthodoxy

C4 concepts may still appear as node metadata, grouping, or UI views, but the stored model is not a hierarchical C4 document.

### Default Granularity

v0.1 defaults to **logical component granularity**.

That means:

- packages, services, apps, modules, or feature slices are first-class nodes
- files are attached to nodes via a `files` array
- files are **not** first-class nodes in the diagram in v0.1

This keeps the architecture understandable for humans while still giving agents traceability into the underlying code.

---

## Storage Model Decision

Archnaut uses a **hybrid storage model**.

### Canonical artifact

- `archnaut.json` is the **canonical, git-tracked artifact** — the source of truth for architecture state, committed to the repository, and portable across machines.
- The local embedded database is a **runtime projection** derived from `archnaut.json`. It is never committed and can always be rebuilt from the JSON file.

These two roles are deliberately distinct. `archnaut.json` is what you commit, share, and review in diffs. The SQLite database is what the running system queries. The server is what keeps them in sync.

### Runtime authority

- the MCP server is the **only mutation authority**
- agents do not write directly to the JSON file
- agents do not write directly to the local database
- all reads and writes go through MCP tools owned by the server

### Sync behavior — bootstrap vs steady-state

**Bootstrap (first run — no `archnaut.json` exists yet):**

1. `archnaut init` starts the daemon; the runtime database starts empty.
2. The developer triggers the scan skill in their AI tool.
3. The agent calls MCP write tools (`cleararchitecture`, `addnode`, `addedge`, etc.); the server populates the runtime database.
4. After the scan completes, the server writes the first normalized `archnaut.json`.

**Steady-state (subsequent starts):**

1. On startup, the server reads `archnaut.json` and hydrates the runtime database from it.
2. After `git pull` or any detected change to `archnaut.json`, the server refreshes or rebuilds the runtime database.
3. On writes (agent or UI), the server updates the runtime database first, then persists a normalized deterministic form back to `archnaut.json`.

This preserves git compatibility and portability while giving the system an efficient runtime query layer.

---

## Web UI Decision

### Packaging

The web UI is a pre-built React + Vite static SPA. The `dist/` output is bundled directly inside the `archnaut` npm package. No separate install is required and no version mismatch between the CLI and the UI is possible.

### Serving

The CLI's single background process serves the SPA via `sirv` in SPA mode (`{ single: true }`), which falls back any unknown route to `index.html`. The MCP Streamable HTTP transport and the WebSocket endpoint share the same port with path-based routing.

### Diagram library

React Flow (`@xyflow/react`) is the diagram engine. The choice is driven by Archnaut's design-mode requirement: custom HTML-rich nodes (component inspector, planned/implemented badges), drag-and-drop node creation, and JSX-per-node styling are all first-class in React Flow and would require significant custom work in Cytoscape.js or D3.js.

- Each `NodeKind` (`component`, `database`, `queue`, `external`) maps to its own React component via `nodeTypes`
- ELK.js (`layered` algorithm) runs in a Web Worker to compute the initial auto-layout on first open
- Node positions are saved back to `archnaut.json` under `meta.layout` so the diagram reopens in the same state without re-running layout on every start
- `onlyRenderVisibleElements={true}` is available as a future progressive enhancement for monorepos with 500+ nodes; it is **not a v0.1 requirement**

### Collaboration

Real-time multi-developer collaboration is out of scope for v0.1. Two developers share state via git and `archnaut.json`. The WebSocket handles single-user live reload: when the MCP server writes to `archnaut.json`, the file watcher emits a change and the browser refreshes the diagram automatically.

### Default port

The default port is `7070`. Port `4200` (Angular CLI default) was rejected to avoid conflict on Angular projects using Archnaut.

---

## MCP Server Lifecycle Decision

### Process model

Archnaut runs as a **self-daemonizing background process**, fully owned and managed by the Archnaut CLI. Neither IDE extensions nor git hooks are responsible for starting or keeping the server alive.

CLI commands:

```
archnaut init     → installs skill, rules, hooks, MCP config; starts daemon as final step
archnaut start    → (re)starts the daemon if stopped
archnaut stop     → graceful SIGTERM shutdown
archnaut status   → PID + GET /health check + uptime
```

### Daemon implementation

- `archnaut start` forks a detached child process (`detached: true`, `child.unref()`)
- PID is written to `.archnaut/daemon.pid`; stdout/stderr redirected to `.archnaut/daemon.log`
- parent process exits immediately after fork
- `archnaut stop` reads the PID file, sends `SIGTERM`, removes the PID file
- `archnaut status` performs a `process.kill(pid, 0)` existence check plus a `GET /health` HTTP probe

### Startup race condition handling

After forking, `archnaut init` and `archnaut start` poll `GET localhost:7070/health` in a retry loop (200ms interval, 5s timeout) before exiting. This avoids the race between port bind and first client connection without using a fixed sleep.

### MCP transport

The MCP server uses **Streamable HTTP transport**. AI tools connect to `localhost:7070/api/mcp` — they do not spawn Archnaut; they connect to the already-running daemon.

For tools that only support stdio transport, Archnaut installs a thin stateless stdio shim at `archnaut init` time. The shim forwards JSON-RPC messages to `localhost:7070/api/mcp` over HTTP and can be spawned cheaply by the IDE as a subprocess.

### AI tool configuration

At `archnaut init` time, Archnaut writes MCP connection entries into the relevant tool config files:

```json
{
  "mcpServers": {
    "archnaut": {
      "url": "http://localhost:7070/api/mcp"
    }
  }
}
```

If the daemon is not running, the tool reports the server as unavailable. The developer runs `archnaut start`. This is explicit and debuggable — no hidden auto-start behavior.

### Rejected alternatives

- **IDE extension manages lifecycle** — requires per-IDE packages, ties server uptime to editor uptime, contradicts repo-installed local-first identity
- **Auto-start via git hooks** — hooks own architecture validation only; mixing lifecycle management adds fragility and blocks git operations during slow starts
- **MCP proxy shim with auto-start** — inverts trust model (agent triggers OS process spawn), creates a second MCP surface to maintain, worsens race conditions on first call

---

## AI Tool Configuration Decision

### Decision

`archnaut init` presents an **interactive multi-select prompt** asking the developer which AI coding tools they use in this project. Archnaut writes config files only for the tools the developer explicitly selects — no silent installs, no configs for tools nobody uses.

### Implementation

- Prompt library: `@clack/prompts` (multi-select with keyboard navigation)
- Before showing the prompt, Archnaut runs a lightweight detector that checks for known config directories and executables; detected tools are **pre-ticked** in the prompt as a convenience — the developer can deselect any
- The developer makes the final call; detection is advisory, not authoritative

### Detection signals


| Tool           | Config dir detected         | Executable detected |
| -------------- | --------------------------- | ------------------- |
| Claude Code    | `~/.claude/`                | `claude` in PATH    |
| Cursor         | `~/.cursor/`                | `cursor` in PATH    |
| Codex (OpenAI) | `~/.codex/`                 | `codex` in PATH     |
| Gemini CLI     | `~/.gemini/`                | `gemini` in PATH    |
| GitHub Copilot | `~/.config/github-copilot/` | `gh` in PATH        |
| Windsurf       | `~/.codeium/windsurf/`      | `windsurf` in PATH  |
| Kiro           | `~/.config/kiro/`           | `kiro` in PATH      |
| Aider          | —                           | `aider` in PATH     |


### Files written per tool


| Tool           | Files written                                     |
| -------------- | ------------------------------------------------- |
| Claude Code    | `CLAUDE.md` + `.claude/settings.json` (MCP entry) |
| Cursor         | `.cursor/rules/archnaut.mdc`                      |
| Codex / OpenAI | `AGENTS.md` + `.codex/hooks.json`                 |
| Gemini CLI     | `GEMINI.md` + `.gemini/settings.json`             |
| GitHub Copilot | `.github/copilot-instructions.md`                 |
| Windsurf       | `.codeium/windsurf/memories/archnaut.md`          |
| Kiro           | `.kiro/steering/archnaut.md`                      |
| Aider          | `.aider.conf.yml` (conventions section)           |


### Non-interactive escape hatch

For CI pipelines or scripted project templates, the prompt can be bypassed:

```sh
archnaut init --tools=claude,cursor
archnaut init --tools=all
```

### Rejected alternatives

- **Auto-detect only, no prompt** — false positives from stale config directories erode trust; no way to handle tools that are not yet installed on the current machine but will be used in CI or by teammates
- **Install all supported formats** — pollutes the repo with config files for tools nobody uses; creates noise in git history and PR diffs

### Scope

All configs are **project-scoped** — written into the current repository, not into global user-level directories. The MCP server URL (`localhost:7070`) is inherently project-local, making global installs meaningless.

---

## Scanning Decision

### Scan mechanism

Architecture scanning is **agent-driven via a dedicated scan skill**. Archnaut does not call any AI API directly and requires no AI API key. The developer's existing AI coding tool does all interpretation work using its own model and credentials.

### Scan skill

At `archnaut init` time, Archnaut installs `.archnaut/skills/scan.md` — a structured prompt that instructs the agent to:

1. Call `cleararchitecture` via MCP
2. Walk the codebase using the agent's own file tools
3. Call `addnode`, `addedge`, `setnodemetadata` via MCP as components and relationships are discovered
4. Call `flagconcern` for anything ambiguous rather than guessing
5. Stop — Archnaut normalizes the graph and writes `archnaut.json`

### Triggering a scan

The developer triggers the scan manually inside their AI tool:


| Tool        | How to trigger                                                    |
| ----------- | ----------------------------------------------------------------- |
| Claude Code | `claude --skill .archnaut/skills/scan.md` or reference in session |
| Cursor      | Open agent chat → type `@archnaut-scan`                           |
| Any tool    | Paste the contents of `.archnaut/skills/scan.md` as a prompt      |


### Scan quality

Scan quality depends on the model the developer is using. Weaker models or short context windows on large monorepos may produce shallow or incomplete diagrams. This is an acceptable v0.1 trade-off — the same trade-off Graphify makes. The `flagconcern` tool is the safety valve: the skill instructs the agent to flag rather than guess when confidence is low.

### Pre-commit stale diagram warning

The pre-commit hook warns (but does not block) when source files have changed in the commit but `archnaut.json` has not. The warning message directs the developer to re-run the scan skill:

```
⚠  archnaut.json hasn't changed in this commit.
   If you added or refactored components, run the scan skill in your AI tool:

   Claude Code:  claude --skill .archnaut/skills/scan.md
   Cursor:       open agent chat → @archnaut-scan
   Other:        see .archnaut/skills/scan.md
```

---

## Pre-Commit Hook Decision

The pre-commit git hook has two distinct responsibilities:

1. **Daemon health check (soft warn)** — if the Archnaut daemon is not running (`GET localhost:7070/health` returns non-200), print a warning with instructions to run `archnaut start`. The commit is **not blocked**. Agents never silently start the daemon.
2. **Stale diagram warning (soft warn)** — if source files changed but `archnaut.json` did not, print a warning and instructions to re-run the scan skill. This is a warning, not a block, because not every code change is architecturally significant.

The hook does **not** start the daemon automatically. The developer is responsible for keeping the daemon running during active development.

### Rationale

A hard block on "daemon not running" would prevent legitimate commits (e.g. documentation changes, quick fixes) during times when a developer has intentionally stopped Archnaut. This contradicts the "respect developer control" principle used throughout the rest of the tool — particularly in rejecting auto-start via agents and git hooks.

A soft warning gives the developer the necessary signal without creating friction that leads to the hook being removed.

### Hard block (future option)

Teams that want stricter enforcement may opt in to a hard block via config:

```json
// archnaut.json → meta
"hookPolicy": "block-on-daemon-down"
```

This is **not a v0.1 feature** but the config key is reserved in the schema to avoid a future breaking change.

---

## Agent Update Loop Decision

For v0.1, Archnaut uses a **task-based MCP update loop** rather than a single free-floating completion signal.

### Core workflow

The canonical agent workflow is:

1. `begin_task`
2. task-scoped architecture mutations through MCP write tools
3. `complete_task`
4. server validation, normalization, persistence, and optional planned → implemented transition

This keeps the update loop aligned with Archnaut's core architectural rule: agents and tools do not edit `archnaut.json` or the local runtime database directly; all state changes go through MCP tools owned by the server.

### Primary completion signal

The primary way a planned feature or component is marked as implemented is **task completion through MCP**.

At the start of work, the coding agent calls `begin_task` with task metadata and the planned node(s) or target architecture region it intends to modify.

During implementation, the agent may call:

- `addnode`
- `addedge`
- `setnodemetadata`
- `flagconcern`

At the end of work, the agent calls `complete_task`.

The server then validates the task, applies any final graph mutations, marks linked planned nodes or edges as implemented where appropriate, normalizes the graph, updates the local runtime database, and persists deterministic JSON back to `archnaut.json`.

### Wire-level task contracts (v0.1)

Required request fields for `begin_task`:

- `taskId`
- `agentId`
- `summary`
- `targetNodeIds`

Optional request fields for `begin_task`:

- `plannedFeatureIds`
- `parentTaskId`
- `metadata`

Illustrative request shape for `begin_task`:

```json
{
  "taskId": "task-2026-06-18-01",
  "agentId": "cursor-session-abc",
  "summary": "Implement recommendations service",
  "targetNodeIds": ["cmp.api.recommendations"],
  "plannedFeatureIds": ["cmp.api.recommendations"]
}
```

Illustrative response shape for `begin_task`:

```json
{
  "ok": true,
  "taskId": "task-2026-06-18-01",
  "status": "in_progress",
  "claimedNodeIds": ["cmp.api.recommendations"],
  "warnings": []
}
```

Required request fields for `complete_task`:

- `taskId`
- `status` (`completed` or `abandoned`)

Optional request fields for `complete_task`:

- `implementedNodeIds`
- `implementedEdgeIds`
- `notes`

Illustrative request shape for `complete_task`:

```json
{
  "taskId": "task-2026-06-18-01",
  "status": "completed",
  "implementedNodeIds": ["cmp.api.recommendations"],
  "notes": "Service implemented with REST endpoint and ranking logic."
}
```

Illustrative response shape for `complete_task`:

```json
{
  "ok": true,
  "taskId": "task-2026-06-18-01",
  "status": "completed",
  "updatedNodeIds": ["cmp.api.recommendations"],
  "createdConcernIds": [],
  "normalized": true
}
```

These contracts are intentionally minimal for the MVP. Archnaut does not need leases, heartbeats, ownership transfer, rollback semantics, or partial commit protocols in v0.1.

### Relationship to `markimplemented`

`markimplemented(featureId)` is a low-level helper, not the primary agent abstraction.

- agents should prefer the `begin_task` / `complete_task` lifecycle
- the server may internally use `markimplemented` as a lower-level helper
- the web UI uses `markimplemented` directly for human-driven manual confirmation

### Secondary completion path

Archnaut also supports **manual confirmation in the web UI**.

This provides a fallback for:

- human-authored changes outside an AI coding session
- correcting mistaken agent updates
- approving implementation after intentional human review

### Deferred completion signals

The following are explicitly **not primary v0.1 completion signals**:

- git commit hooks
- test-pass automation

These may be added later as supporting signals or integrations, but they should not own the canonical implementation-state transition in the MVP.

### Conflict handling (v0.1)

For v0.1, concurrent architecture updates use **soft task claims, server-side serialization, last-writer-wins state resolution, and concern logging**.

That means:

- `begin_task` places a soft claim on the target architecture region
- claims are advisory, not hard locks
- the MCP server serializes incoming writes within a running project instance
- if overlapping tasks mutate the same nodes or edges, the latest accepted write becomes current runtime state
- the server may automatically log a `concern` when overlapping or suspicious mutations occur

### Abandoned task policy

Task lifecycle states in v0.1 are:

- `in_progress`
- `completed`
- `abandoned`

A task becomes **stale** if no activity is recorded for 24 hours.

When a task becomes stale:

- it is automatically marked `abandoned`
- any soft claims associated with it are released
- it is not automatically deleted

Abandoning a task does **not** roll back graph mutations already applied through MCP write tools during that task.

This is intentional. In v0.1, task state is a coordination mechanism, not a transactional rollback mechanism.

The server should automatically create a low-severity `concern` if an abandoned task overlapped with another task or touched planned nodes that remain unimplemented.

### Concern heuristics

The server should automatically create a `concern` when:

- two active tasks claim at least one same `targetNodeId`
- a task completes with `implementedNodeIds` outside its originally claimed target region
- a scan proposes a new node that strongly resembles an existing node but cannot be matched confidently
- a planned node remains unimplemented while related implemented edges or dependent nodes appear around it
- a task is abandoned after mutating a planned feature area
- a task marks something implemented but the attached `files` array is still empty

The server should **not** automatically create a `concern` when:

- two tasks touch different nodes in the same workspace
- a task updates metadata only
- a rescan merely reorders or normalizes existing graph content
- a human manually confirms implementation through the UI for an already planned node

Suggested default severities:

- `low` — stale or abandoned task, metadata mismatch, incomplete descriptive fields
- `medium` — overlapping task claims, ambiguous rescan match, implemented node with weak file traceability
- `high` — conflicting completions on the same node, duplicate components created for the same apparent code area, destructive rescan proposal

### Stability rules

To reduce architectural drift and non-deterministic churn, v0.1 follows these rules:

- the MCP server is the only mutation authority
- IDs are assigned and preserved by the server
- deterministic normalization is applied before every write to `archnaut.json`
- rescans should prefer updating an existing matched node rather than creating a near-duplicate
- planned nodes are never silently deleted by a scan just because code has not been detected yet
- when scan confidence is low, the system should log a `concern` instead of rewriting architecture aggressively

This design favors stability over aggressive automation, which is the correct trade-off for the MVP.

---

## Initial `archnaut.json` Schema (v0.1)

### Top-level shape

```ts
interface ArchnautFileV1 {
  version: 1;
  project: Project;
  workspaces: Workspace[];
  nodes: Node[];
  edges: Edge[];
  concerns: Concern[];
  meta: Meta;
}
```

### Project

```ts
interface Project {
  id: string;
  name: string;
  root: string;
  packageManager?: "npm" | "yarn" | "pnpm" | "bun";
  monorepo: boolean;
}
```

### Workspace

```ts
interface Workspace {
  id: string;
  name: string;
  path: string;
  kind: "app" | "package" | "service" | "library";
  tags?: string[];
}
```

### Node

```ts
type NodeKind =
  | "component"
  | "database"
  | "queue"
  | "external";

type NodeStatus = "planned" | "implemented";

interface Node {
  id: string;
  name: string;
  workspaceId?: string;
  kind: NodeKind;
  status: NodeStatus;
  files: string[];
  tags?: string[];
  tech?: string[];
  layer?: "frontend" | "backend" | "infrastructure";
  metadata?: {
    description?: string;
    [key: string]: unknown;
  };
}
```

### Edge

```ts
type EdgeType =
  | "depends_on"
  | "calls"
  | "reads_writes"
  | "publishes"
  | "subscribes"
  | "owns";

type EdgeStatus = "planned" | "implemented";

interface Edge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  status: EdgeStatus;
  metadata?: {
    description?: string;
    [key: string]: unknown;
  };
}
```

### Concern

```ts
type ConcernSeverity = "low" | "medium" | "high";
type ConcernStatus = "open" | "resolved";

interface Concern {
  id: string;
  scope: string;
  severity: ConcernSeverity;
  status: ConcernStatus;
  source: "agent" | "human";
  description: string;
}
```

### Meta

```ts
interface Meta {
  schemaVersion?: string;
  createdBy?: string;
  lastNormalizedAt?: string;
  layout?: Record<string, { x: number; y: number }>;
  hookPolicy?: "warn-on-daemon-down" | "block-on-daemon-down"; // reserved, not active in v0.1
}
```

> `meta.layout` stores node positions keyed by node ID after the first ELK.js auto-layout run, so the diagram reopens in the same state without re-running layout on every start.
> `meta.hookPolicy` is reserved for future opt-in strict enforcement; default behavior in v0.1 is always `warn-on-daemon-down`.

### ID strategy

To keep diffs stable and rescans predictable:

- `Workspace.id` uses semantic IDs such as `ws.web`
- internal `Node.id` values use semantic IDs such as `cmp.api.checkout`
- database and external IDs use prefixes such as `db.users` and `ext.stripe`
- `Edge.id` uses stable semantic combinations such as `edge.api.checkout-stripe-calls`
- the MCP server assigns and preserves IDs across rescans

### Normalization rules

Before writing `archnaut.json`, the server normalizes the output:

- sort `workspaces` by `id`
- sort `nodes` by `id`
- sort `edges` by `id`
- sort `concerns` by `id`
- write deterministic formatting for clean git diffs

---

## Example `archnaut.json`

```json
{
  "version": 1,
  "project": {
    "id": "repo.shop-platform",
    "name": "Shop Platform",
    "root": ".",
    "packageManager": "pnpm",
    "monorepo": true
  },
  "workspaces": [
    { "id": "ws.web",    "name": "web",    "path": "apps/web",          "kind": "app"     },
    { "id": "ws.api",    "name": "api",    "path": "apps/api",          "kind": "app"     },
    { "id": "ws.shared", "name": "shared", "path": "packages/shared",   "kind": "package" }
  ],
  "nodes": [
    {
      "id": "cmp.web.storefront", "name": "Storefront UI",
      "workspaceId": "ws.web", "kind": "component", "status": "implemented",
      "files": ["apps/web/src/pages/Home.tsx"]
    },
    {
      "id": "cmp.api.catalog", "name": "Catalog Service",
      "workspaceId": "ws.api", "kind": "component", "status": "implemented",
      "files": ["apps/api/src/modules/catalog"]
    },
    {
      "id": "cmp.api.checkout", "name": "Checkout Service",
      "workspaceId": "ws.api", "kind": "component", "status": "implemented",
      "files": ["apps/api/src/modules/checkout"]
    },
    {
      "id": "pkg.shared.types", "name": "Shared Types",
      "workspaceId": "ws.shared", "kind": "component", "status": "implemented",
      "files": ["packages/shared/src/types.ts"]
    },
    {
      "id": "ext.stripe", "name": "Stripe",
      "kind": "external", "status": "implemented", "files": []
    },
    {
      "id": "cmp.api.recommendations", "name": "Recommendations Service",
      "workspaceId": "ws.api", "kind": "component", "status": "planned",
      "files": [],
      "metadata": { "description": "Planned recommendation engine for product suggestions." }
    }
  ],
  "edges": [
    { "id": "edge.web.storefront-api.catalog-calls",         "from": "cmp.web.storefront",  "to": "cmp.api.catalog",         "type": "calls",      "status": "implemented" },
    { "id": "edge.web.storefront-api.checkout-calls",        "from": "cmp.web.storefront",  "to": "cmp.api.checkout",        "type": "calls",      "status": "implemented" },
    { "id": "edge.api.catalog-shared.types-depends_on",      "from": "cmp.api.catalog",     "to": "pkg.shared.types",        "type": "depends_on", "status": "implemented" },
    { "id": "edge.api.checkout-stripe-calls",                "from": "cmp.api.checkout",    "to": "ext.stripe",              "type": "calls",      "status": "implemented" },
    { "id": "edge.api.catalog-api.recommendations-calls",    "from": "cmp.api.catalog",     "to": "cmp.api.recommendations", "type": "calls",      "status": "planned"     }
  ],
  "concerns": [
    {
      "id": "concern.recommendations-source",
      "scope": "cmp.api.recommendations",
      "severity": "medium", "status": "open", "source": "human",
      "description": "Need to decide whether recommendations are batch-generated or request-time."
    }
  ],
  "meta": {
    "createdBy": "archnaut",
    "schemaVersion": "1.0.0",
    "lastNormalizedAt": "2026-06-19T00:09:00Z",
    "layout": {}
  }
}
```

---

## MVP Scope (v0.1)

A focused first release to validate core assumptions before building the full system. This list is authoritative — anything not listed here is post-v0.1, regardless of how it is described elsewhere in the document.

1. `archnaut init` presents multi-select prompt for AI tool selection, installs skill / minimal rules / hooks / MCP config only for selected tools, starts the daemon as its final step
2. Developer triggers the scan skill in their AI tool to populate `archnaut.json` via MCP write tools
3. Creates the local runtime DB from `archnaut.json`
4. Generates minimal AI tool config files (CLAUDE.md, .cursorrules, AGENTS.md, etc.) for selected tools — one "consult Archnaut first" rules file per tool; advanced architectural constraint rules are post-v0.1
5. Local web UI displays a live block diagram and component inspector from the runtime store / `archnaut.json` source
6. MCP server exposes `getarchitecture`, `getcomponentcontext`, `getplannedfeatures`, `begin_task`, `addnode`, `addedge`, `setnodemetadata`, `complete_task`, `markimplemented`, `flagconcern`, `cleararchitecture`, `updatearchitecture` — **stateless write tools implemented in `@archnaut/server`** (`cleararchitecture`, `addnode`, `addedge`, `setnodemetadata`, `flagconcern`); **task lifecycle tools pending** (`begin_task`, `complete_task`, `markimplemented`, `updatearchitecture`; requires `tasks` table)
7. Manual add-planned-feature flow in the web UI, persisted through MCP back to normalized `archnaut.json`
8. Pre-commit hook soft-warns if daemon is not running; soft-warns if `archnaut.json` is stale

**Explicitly out of scope for v0.1:**

- `archnaut upgrade` (template diff + confirm) → v0.2
- Diff view (planned vs implemented overlay) → post-v0.1
- Drift alerts in the UI → post-v0.1
- Anti-pattern detection / background validation rules → post-v0.1
- Token-aware context injection → post-v0.1
- Large monorepo performance tuning (500+ nodes) → post-v0.1
- Hard-block pre-commit hook policy → post-v0.1 (config key reserved in schema)

---

## Rules / Skills Maintenance Decision

### Decision

Skill and rules templates are versioned, installed at `archnaut init` time, and updated only via an explicit `archnaut upgrade` CLI command.

Existing projects never have their `.archnaut/skills` or tool-specific rules files silently overwritten.

`**archnaut upgrade` is a v0.2 feature, not a v0.1 requirement.** Early adopters in v0.1 may need to regenerate configs manually by re-running `archnaut init --tools=<selection>` after updating the npm package. This is acceptable for a pre-release version.

### Implementation (v0.2)

- `archnaut upgrade` compares installed skill and rule files against templates bundled with the currently installed npm package version.
- When differences are detected, Archnaut prints a human-readable diff and asks the developer to confirm before overwriting any file.
- The command is safe and idempotent to run after `npm update archnaut`.
- Optionally, the pre-commit hook may emit a soft warning if the installed skill template version lags behind the npm package version, nudging the developer to run `archnaut upgrade`.

### Rationale

This approach avoids two failure modes:

- Silent overwrites that destroy local customizations to skills and rules.
- Skill and rule rot in long-lived projects where templates never get updated.

By making upgrades explicit, Archnaut preserves trust while still allowing the project to evolve its default behaviors over time.

---

## Decisions Already Made

> This table is a **navigational index**. Authoritative details live in the corresponding sections above. If this table and a section disagree, the section wins.


| Topic                           | Decision                                                                                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language support                | Maximum, agent-driven. No AST parsers required.                                                                                                                                                                              |
| Monorepo support                | v0.1, native. Single repo-level model.                                                                                                                                                                                       |
| License                         | Apache 2.0. Adoption plus patent protection.                                                                                                                                                                                 |
| Package name                    | `archnaut`. Reserved on npm.                                                                                                                                                                                                 |
| Scanning mechanism              | Agent-driven via scan skill. No AI API key in Archnaut. Language-agnostic, richer semantics.                                                                                                                                 |
| Scan trigger                    | Manual — developer runs scan skill in their AI tool (`@archnaut-scan` / `--skill`).                                                                                                                                          |
| Deployment model                | Local-first. No data leaves the machine.                                                                                                                                                                                     |
| Diagram model                   | Freeform graph with C4-flavored metadata.                                                                                                                                                                                    |
| Default granularity             | Logical component level. Files attached as metadata only.                                                                                                                                                                    |
| Storage model                   | Hybrid: `archnaut.json` is the canonical git-tracked artifact; SQLite is the runtime projection.                                                                                                                             |
| Export format                   | Single root `archnaut.json`. Simple, reviewable, recoverable.                                                                                                                                                                |
| Architecture authority          | MCP server owns reads and writes. Agents never edit JSON or DB directly.                                                                                                                                                     |
| Bootstrap vs steady-state       | First run: scan populates runtime DB, server writes first JSON. Subsequent starts: server hydrates DB from JSON.                                                                                                             |
| Agent update loop               | Task-based MCP lifecycle. `begin_task` / `complete_task`, soft claims, concern logging.                                                                                                                                      |
| Web UI packaging                | Bundled pre-built SPA inside `archnaut`. No separate package.                                                                                                                                                                |
| Web UI serving                  | `sirv` SPA mode, shared port with MCP.                                                                                                                                                                                       |
| Process model                   | Single background process, single port.                                                                                                                                                                                      |
| Default port                    | `7070`. Port `4200` rejected (Angular CLI conflict).                                                                                                                                                                         |
| Diagram library                 | React Flow (`@xyflow/react`).                                                                                                                                                                                                |
| Auto-layout                     | ELK.js `layered` algorithm, Web Worker, positions saved to `meta.layout`.                                                                                                                                                    |
| Collaboration (v0.1)            | Single-user local only. Multi-dev via git. CRDT/OT is post-MVP.                                                                                                                                                              |
| Runtime DB                      | Embedded SQLite via `better-sqlite3`. File-based, no network port, stored at `.archnaut/db.sqlite`.                                                                                                                          |
| MCP server lifecycle            | Self-daemonizing background process. `archnaut start` / `stop` / `status`. PID at `.archnaut/daemon.pid`. Started automatically at end of `archnaut init`.                                                                   |
| MCP transport                   | Streamable HTTP at `localhost:7070/api/mcp`. Thin stdio shim for tools requiring subprocess transport.                                                                                                                       |
| Daemon auto-start by agents     | Rejected. Daemon is started by developer via CLI only.                                                                                                                                                                       |
| IDE extension for lifecycle     | Rejected (v0.1). Requires per-IDE packages; contradicts repo-installed identity.                                                                                                                                             |
| Git hooks as lifecycle trigger  | Rejected. Hooks own validation only; daemon start is CLI responsibility.                                                                                                                                                     |
| Pre-commit hook — daemon check  | Soft warning (not hard block). Hard block is opt-in via `meta.hookPolicy` (post-v0.1).                                                                                                                                       |
| Pre-commit hook — stale diagram | Soft warning if source changed but `archnaut.json` did not; prints scan skill instructions.                                                                                                                                  |
| AI tool configuration           | Interactive `@clack/prompts` multi-select at `archnaut init`. Detected tools pre-ticked. `--tools=a,b` flag for CI. Project-scoped only. Auto-detect-only rejected (false positives). Install-all rejected (repo pollution). |
| Rules engine (v0.1)             | Minimal "consult Archnaut first" rules file per selected tool. Advanced constraint rules are post-v0.1.                                                                                                                      |
| `archnaut upgrade`              | Post-v0.1 (v0.2). v0.1 users update configs manually.                                                                                                                                                                        |


---

## Name / Identity


| Property        | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Name            | Archnaut                                               |
| npm package     | `archnaut`                                             |
| License         | Apache 2.0                                             |
| Tagline (draft) | Navigate your architecture. Keep your agents grounded. |
| Domain          | `archnaut.dev`                                         |
| Inspiration     | Graphify, Solarch                                      |


