import { z } from "zod";
import { workspaceKindSchema } from "./enums.schema.js";

export const workspaceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    path: z.string(),
    kind: workspaceKindSchema,
    tags: z.array(z.string()).optional(),
  })
  .strict();

export type Workspace = z.infer<typeof workspaceSchema>;
