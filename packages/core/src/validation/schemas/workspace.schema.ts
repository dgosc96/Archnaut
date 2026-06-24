import { z } from "zod";

import type { Workspace } from "../../schema/workspace.js";
import { workspaceKindSchema } from "./enums.schema.js";

export const workspaceSchema: z.ZodType<Workspace> = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    path: z.string(),
    kind: workspaceKindSchema,
    tags: z.array(z.string()).optional(),
  })
  .strict();

export type { Workspace } from "../../schema/workspace.js";
