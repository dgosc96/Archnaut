# Contributing to Archnaut

First off, thank you for your interest in contributing to Archnaut — a repo‑installed architecture management layer for AI‑assisted development.[^project]

Archnaut is still in early development (targeting v0.1), so careful alignment with the project definition and architecture decisions is critical.

- Project definition: see `PROJECT.md`
- Architecture rules for AI agents: `.cursor/rules/archnaut.mdc`
- Session handoff snapshot: `CURRENT.md`

[^project]: Archnaut’s goals, scope, and architecture are defined in the project definition document.

---

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct (TODO: link `CODE_OF_CONDUCT.md` once added). A short version:

- Be respectful and constructive.
- Assume good intent.
- Disagreement is fine; personal attacks are not.

---

## How Can I Contribute?

We welcome contributions in many forms:

- **Bug reports** – issues with clear reproduction steps, expected vs actual behavior, and environment details.
- **Feature discussions** – proposals that stay within the v0.1 scope, or clearly marked as “post‑v0.1”.
- **Documentation** – clarifying the project definition, improving `PROJECT.md`, `CURRENT.md`, and inline docs.
- **Architecture‑aligned code** – implementing parts of the CLI, daemon, MCP server, web UI, and rules engine in line with the decisions in the project definition.[^project]

If you’re not sure where to start, look for issues labeled `good first issue` or `help wanted`.

---

## Development Setup

Archnaut is a Node.js monorepo with pnpm workspaces.

### Prerequisites

- Node.js 18+ (LTS recommended)
- `pnpm` installed globally (`npm install -g pnpm`)
- Git

### Initial setup

```sh
# install dependencies
pnpm install

# verify workspaces
pnpm -r --parallel --if-present run lint
pnpm -r test --parallel --if-present
```

Target monorepo structure (packages are being bootstrapped — see `CURRENT.md`):

```text
/
  .cursor/
    rules/archnaut.mdc   # agent context for this repo (always applied)
    mcp.json             # not yet — added once MCP server is ready for local use
  packages/
    core/                # @archnaut/core — domain model, validation, SQLite projection
    server/              # @archnaut/server — HTTP, MCP, runtime store
    cli/                 # (planned) Commander.js CLI
    daemon/              # (planned) self-daemonizing process manager
    mcp-shim/            # (planned) stdio-to-HTTP proxy
    web-ui/              # (planned) React + Vite SPA
    rules-engine/        # (planned) AI tool config installer
  PROJECT.md
  CONTRIBUTING.md
  CURRENT.md
  archnaut.json          # canonical artifact once dogfooding begins (MCP scan)
  package.json
  pnpm-workspace.yaml
  .gitignore
```

> **Note:** `.cursor/mcp.json` is not in the repo yet. It will be added here once the MCP server can be run locally for dogfooding. End-user repos receive the same config from `archnaut init` via the rules engine.

---

## Architectural Ground Rules

This project is *architecture‑driven*. Before writing code:

1. **Read the project definition** (`PROJECT.md`).
2. **Read `.cursor/rules/archnaut.mdc`** to understand module boundaries and locked tech decisions.

Key points:

- `archnaut.json` is the **canonical git‑tracked architecture artifact** once it exists.
- The **MCP server is the only mutation authority** for `archnaut.json` and the SQLite DB.
- No direct writes to `archnaut.json` or `.archnaut/db.sqlite` from your code.
- Keep within the v0.1 scope; post‑v0.1 features must be clearly marked and usually deferred.

If your change touches architecture (new MCP tools, storage behavior, diagram semantics), consider updating:

- `PROJECT.md` (project definition / decisions)
- `CURRENT.md` (current state and next steps)
- Any relevant comments in `.cursor/rules/archnaut.mdc`

---

## Branch, Issue, and PR Workflow

1. **Find or open an issue**
   - Search existing issues first to avoid duplicates.
   - For new issues, include:
     - Clear title
     - Motivation / problem statement
     - v0.1 vs “later” scope
     - Reproduction steps (for bugs)

2. **Create a feature branch**

```sh
git checkout -b feat/short-description
# or
git checkout -b fix/short-description
```

3. **Implement your change**
   - Keep changes as small and focused as possible (single feature or bugfix per PR).
   - Maintain existing patterns and file structure.
   - Prefer modifying existing modules over adding new ones unless architecture suggests otherwise.

4. **Run checks locally**

```sh
pnpm lint
pnpm lint:docs
pnpm test
# or, in a single package:
cd packages/core
pnpm lint
pnpm test
```

5. **Open a Pull Request**
   - Reference the issue number (e.g. “Fixes #42”).
   - Describe what you changed and why.
   - Note any follow‑up work or limitations.
   - Attach screenshots or logs when relevant (e.g., web UI changes, daemon behavior).

---

## Coding Style and Conventions

- **Language & tooling**
  - TypeScript for application code.
  - Node.js + Commander.js for the CLI.
  - React + Vite for the web UI.
  - `better-sqlite3` for the embedded DB.
  - `@modelcontextprotocol/sdk` for MCP.

- **Monorepo**
  - Use pnpm workspaces; don’t add ad‑hoc package managers.
  - Keep shared types, schema definitions, validation, and normalization in `packages/core/` (`@archnaut/core`).

- **Linting**
  - ESLint config lives at the repo root only (`eslint.config.mjs`).
  - Each workspace package opts in via a `"lint": "eslint ."` script; rules are scoped by `basePath` in the root config.
  - When adding a new package: add a `basePath` entry in `eslint.config.mjs` and a `"lint": "eslint ."` script in the package.
  - Do not add per-package ESLint config files unless a package needs genuinely different rules (post‑v0.1).

## Docstrings

Archnaut uses **JSDoc** for inline documentation. All public-facing and non-trivial
internal code must be documented.

### When to add a docstring

Add a JSDoc comment (`/** ... */`) to:
- All exported functions, classes, and interfaces
- MCP tool handler functions (read and write tools)
- CLI command handlers
- Non-obvious internal helpers (e.g. daemon lifecycle, sync logic, normalization)
- Every property of the `archnaut.json` schema interfaces in `packages/core/src/schema/` (documented interfaces) and `packages/core/src/validation/schemas/` (Zod runtime schemas)

Skip docstrings on:
- Simple React presentational components whose props are self-explanatory
- Private one-liner utilities whose names fully describe their behavior

### Format

This is a TypeScript project. **Do not repeat type information** in `@param` or
`@returns` — TypeScript already carries types. Describe intent and constraints instead.

Required tags by context:

| Tag          | When required                                             |
|--------------|-----------------------------------------------------------|
| `@param`     | Every parameter; describe purpose/constraints, not type  |
| `@returns`   | Any function that returns a meaningful value              |
| `@throws`    | Any function that can throw; include error type          |
| `@example`   | All MCP tool handlers and CLI commands                   |
| `@remarks`   | Non-obvious side effects or behavioral warnings          |
| `@deprecated`| Anything being phased out; include migration note        |

Example:

```ts
/**
 * Applies a validated mutation to the SQLite projection and persists
 * the result to archnaut.json via the normalization pipeline.
 *
 * Skips if validation throws before the mutation runs — the DB and file
 * are rolled back on any failure inside the callback.
 *
 * @param archPath - Path to the canonical archnaut.json file.
 * @param db - Open better-sqlite3 handle for the runtime projection.
 * @param mutate - Callback that performs DB mutations after optional validation.
 * @throws When persistence or normalization fails after a successful mutation.
 *
 * @example
 * await applyArchitectureMutation(archPath, db, () => {
 *   upsertNode(db, { id: 'cmp.api.checkout', kind: 'component', status: 'planned', ... });
 * });
 */
export async function applyArchitectureMutation(
  archPath: string,
  db: Database.Database,
  mutate: () => void,
): Promise<void> { ... }
```

### Linting

Docstring coverage is enforced by `eslint-plugin-jsdoc` (recommended-typescript preset).
Run `pnpm lint:docs` to check for missing or malformed docstrings before opening a PR.
The CI pipeline runs this check automatically.

---

- **Tests**
  - New behavior should have tests where practical.
  - Prefer small, focused tests that validate behavior and architectural contracts.

- **IDs (semantic conventions)**
  - `@archnaut/core` owns ID parse/generate helpers; the MCP server is the mutation authority in production.
  - **Edge IDs** use `generateEdgeId(fromId, toId, type)` in `@archnaut/core`: `edge.<fromTail>-<toTail>-<type>` where endpoint tails come from `endpointSlug` (e.g. `cmp.api.checkout` → `api.checkout`, `ext.stripe` → `stripe` yields `edge.api.checkout-stripe-calls`). IDs are a pure function of the triple — repeatable across runs.
  - Legacy hand-authored IDs such as `edge.web-catalog` still load (validation warning only). **New edge IDs must use the generator.**

- **Commits**
  - Use clear, descriptive messages (e.g. `cli: add archnaut init skeleton`).
  - Avoid large, multi‑topic commits.

### Commit message style

Use scope‑prefixed, single‑line commit messages:

- Format: `scope: short imperative description`
- Scope examples: `cli`, `server`, `web-ui`, `daemon`, `rules`, `core`, `docs`, `repo`
- Keep the subject under ~72 characters and write it in the imperative mood:
  - `cli: add archnaut init skeleton`
  - `server: implement getarchitecture tool`
  - `docs: document storage model in PROJECT.md`
- When applicable, reference issues: `web-ui: add node inspector panel (closes #42)`

---

## Using AI Tools (Cursor, Claude Code, etc.)

Archnaut is designed to work with AI coding tools, but contributors must:

- Ensure AI‑generated code **respects architecture rules** and module boundaries.
- Review AI output carefully; you are responsible for what you commit.
- Prefer using the project’s `.cursor/rules/archnaut.mdc` in Cursor so agents have the correct context.

If you’re unsure whether an AI‑generated change fits the architecture, open a draft PR and ask for feedback.

---

## Questions and Support

If something is unclear:

- Open a GitHub issue with the label `question`.
- Or start a discussion (if enabled) about design or scope questions.

Please include as much context as possible so maintainers can help quickly.
