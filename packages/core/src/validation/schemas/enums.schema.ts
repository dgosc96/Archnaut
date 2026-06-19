import { z } from "zod";

export const packageManagerSchema = z.enum(["npm", "yarn", "pnpm", "bun"]);
export const workspaceKindSchema = z.enum(["app", "package", "service", "library"]);
export const nodeKindSchema = z.enum(["component", "database", "queue", "external"]);
export const nodeStatusSchema = z.enum(["planned", "implemented"]);
export const nodeLayerSchema = z.enum(["frontend", "backend", "infrastructure"]);
export const edgeTypeSchema = z.enum([
  "depends_on",
  "calls",
  "reads_writes",
  "publishes",
  "subscribes",
  "owns",
]);
export const edgeStatusSchema = z.enum(["planned", "implemented"]);
export const concernSeveritySchema = z.enum(["low", "medium", "high"]);
export const concernStatusSchema = z.enum(["open", "resolved"]);
export const concernSourceSchema = z.enum(["agent", "human"]);
export const hookPolicySchema = z.enum(["warn-on-daemon-down", "block-on-daemon-down"]);

export type PackageManager = z.infer<typeof packageManagerSchema>;
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export type NodeStatus = z.infer<typeof nodeStatusSchema>;
export type NodeLayer = z.infer<typeof nodeLayerSchema>;
export type EdgeType = z.infer<typeof edgeTypeSchema>;
export type EdgeStatus = z.infer<typeof edgeStatusSchema>;
export type ConcernSeverity = z.infer<typeof concernSeveritySchema>;
export type ConcernStatus = z.infer<typeof concernStatusSchema>;
export type ConcernSource = z.infer<typeof concernSourceSchema>;
export type HookPolicy = z.infer<typeof hookPolicySchema>;
