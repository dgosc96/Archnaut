import { z } from "zod";
import { hookPolicySchema } from "./enums.schema.js";

export const layoutEntrySchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();

export const metaSchema = z
  .object({
    schemaVersion: z.string().optional(),
    createdBy: z.string().optional(),
    lastNormalizedAt: z.string().optional(),
    layout: z.record(z.string(), layoutEntrySchema).optional(),
    hookPolicy: hookPolicySchema.optional(),
  })
  .strict();

export type LayoutEntry = z.infer<typeof layoutEntrySchema>;
export type Meta = z.infer<typeof metaSchema>;
