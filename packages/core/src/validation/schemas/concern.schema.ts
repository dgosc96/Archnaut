import { z } from "zod";

import type { Concern } from "../../schema/concern.js";
import {
  concernSeveritySchema,
  concernSourceSchema,
  concernStatusSchema,
} from "./enums.schema.js";

export const concernSchema: z.ZodType<Concern> = z
  .object({
    id: z.string().min(1),
    scope: z.string().min(1),
    severity: concernSeveritySchema,
    status: concernStatusSchema,
    source: concernSourceSchema,
    description: z.string().min(1),
  })
  .strict();

export type { Concern } from "../../schema/concern.js";
