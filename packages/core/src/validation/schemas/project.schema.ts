import { z } from "zod";

import type { Project } from "../../schema/project.js";
import { packageManagerSchema } from "./enums.schema.js";

export const projectSchema: z.ZodType<Project> = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    root: z.string(),
    packageManager: packageManagerSchema.optional(),
    monorepo: z.boolean(),
  })
  .strict();

export type { Project } from "../../schema/project.js";
