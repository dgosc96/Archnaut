import { z } from "zod";

import {
  ARCHNAUT_FILE_VERSION,
  type ArchnautFileV1,
} from "../../schema/archnaut-file.js";
import { concernSchema } from "./concern.schema.js";
import { edgeSchema } from "./edge.schema.js";
import { metaSchema } from "./meta.schema.js";
import { nodeSchema } from "./node.schema.js";
import { projectSchema } from "./project.schema.js";
import { workspaceSchema } from "./workspace.schema.js";

export { ARCHNAUT_FILE_VERSION } from "../../schema/archnaut-file.js";

export const archnautFileSchema: z.ZodType<ArchnautFileV1> = z
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

export type { ArchnautFileV1 } from "../../schema/archnaut-file.js";
