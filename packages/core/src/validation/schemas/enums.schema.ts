import { z } from "zod";
import type {
  ConcernSeverity,
  ConcernSource,
  ConcernStatus,
  EdgeStatus,
  EdgeType,
  HookPolicy,
  NodeKind,
  NodeLayer,
  NodeStatus,
  PackageManager,
  WorkspaceKind,
} from "../../schema/enums.js";

export const packageManagerSchema = z.enum(["npm", "yarn", "pnpm", "bun"]) satisfies z.ZodType<PackageManager>;
export const workspaceKindSchema = z.enum([
  "app",
  "package",
  "service",
  "library",
]) satisfies z.ZodType<WorkspaceKind>;
export const nodeKindSchema = z.enum([
  "component",
  "database",
  "queue",
  "external",
]) satisfies z.ZodType<NodeKind>;
export const nodeStatusSchema = z.enum(["planned", "implemented"]) satisfies z.ZodType<NodeStatus>;
export const nodeLayerSchema = z.enum([
  "frontend",
  "backend",
  "infrastructure",
]) satisfies z.ZodType<NodeLayer>;
export const edgeTypeSchema = z.enum([
  "depends_on",
  "calls",
  "reads_writes",
  "publishes",
  "subscribes",
  "owns",
]) satisfies z.ZodType<EdgeType>;
export const edgeStatusSchema = z.enum(["planned", "implemented"]) satisfies z.ZodType<EdgeStatus>;
export const concernSeveritySchema = z.enum(["low", "medium", "high"]) satisfies z.ZodType<ConcernSeverity>;
export const concernStatusSchema = z.enum(["open", "resolved"]) satisfies z.ZodType<ConcernStatus>;
export const concernSourceSchema = z.enum(["agent", "human"]) satisfies z.ZodType<ConcernSource>;
export const hookPolicySchema = z.enum([
  "warn-on-daemon-down",
  "block-on-daemon-down",
]) satisfies z.ZodType<HookPolicy>;

export type {
  PackageManager,
  WorkspaceKind,
  NodeKind,
  NodeStatus,
  NodeLayer,
  EdgeType,
  EdgeStatus,
  ConcernSeverity,
  ConcernStatus,
  ConcernSource,
  HookPolicy,
} from "../../schema/enums.js";
