import { z } from "zod";
import { concernSchema } from "./concern.schema.js";
import { edgeSchema } from "./edge.schema.js";
import { metaSchema } from "./meta.schema.js";
import { nodeSchema } from "./node.schema.js";
import { projectSchema } from "./project.schema.js";
import { workspaceSchema } from "./workspace.schema.js";

export const ARCHNAUT_FILE_VERSION = 1 as const;

export const archnautFileSchema = z
  .object({
    version: z.literal(ARCHNAUT_FILE_VERSION),
    project: projectSchema,
    workspaces: z.array(workspaceSchema),
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    concerns: z.array(concernSchema),
    meta: metaSchema,
  })
  .strict();

export type ArchnautFileV1 = z.infer<typeof archnautFileSchema>;
