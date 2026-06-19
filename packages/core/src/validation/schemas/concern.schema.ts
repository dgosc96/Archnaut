import { z } from "zod";
import {
  concernSeveritySchema,
  concernSourceSchema,
  concernStatusSchema,
} from "./enums.schema.js";

export const concernSchema = z
  .object({
    id: z.string().min(1),
    scope: z.string().min(1),
    severity: concernSeveritySchema,
    status: concernStatusSchema,
    source: concernSourceSchema,
    description: z.string().min(1),
  })
  .strict();

export type Concern = z.infer<typeof concernSchema>;
