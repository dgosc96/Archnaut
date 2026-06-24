import { z } from "zod";

import type { Project } from "../../schema/project.js";
import { packageManagerSchema } from "./enums.schema.js";

export const projectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    root: z.string(),
    packageManager: packageManagerSchema.optional(),
    monorepo: z.boolean(),
  })
  .strict() satisfies z.ZodType<Project>;

export type { Project } from "../../schema/project.js";
