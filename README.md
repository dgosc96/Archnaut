# Archnaut

> AI-powered architecture management layer for agentic coding.

**This package is under active development. Coming soon.**

## Development

The in-repo monorepo already implements `@archnaut/core` (domain layer, SQLite projection, mutation pipeline) and `@archnaut/server` (HTTP, MCP read tools, and stateless write tools). CLI packaging, daemon lifecycle, web UI, and rules/hooks installation are still in progress. See [`CURRENT.md`](CURRENT.md) for the latest implementation status.

## What it will do

- Scan your repo and visualize architecture as interactive block diagrams
- Locally hosted web app for designing new features (marking them as planned vs implemented)
- MCP server for seamless AI agent integration (Cursor, Claude Code, Codex, Antigravity, etc.)
- Auto-installs rules, hooks, and skills for your AI coding tool
- Keeps agents grounded in your actual architecture to prevent drift

## Stay tuned

⭐ Star the repo to follow progress: https://github.com/dgosc96/Archnaut