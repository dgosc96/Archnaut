import type { PackageManager } from "./enums.js";

/** Repository-level metadata stored in `archnaut.json`. */
export interface Project {
  /** Stable identifier for the repository (e.g. `repo.shop-platform`). */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** Path to the repository root relative to `archnaut.json`; normalized to forward slashes on save. */
  root: string;
  /** Package manager detected or declared for the repo root. */
  packageManager?: PackageManager;
  /** True when the project spans multiple workspaces (monorepo layout). */
  monorepo: boolean;
}
