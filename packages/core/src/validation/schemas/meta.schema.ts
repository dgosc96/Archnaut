import { z } from "zod";

import type { LayoutEntry, Meta } from "../../schema/meta.js";
import { hookPolicySchema } from "./enums.schema.js";

export const layoutEntrySchema: z.ZodType<LayoutEntry> = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();

export const metaSchema: z.ZodType<Meta> = z
  .object({
    schemaVersion: z.string().optional(),
    createdBy: z.string().optional(),
    lastNormalizedAt: z.string().optional(),
    layout: z.record(z.string(), layoutEntrySchema).optional(),
    hookPolicy: hookPolicySchema.optional(),
  })
  .strict();

export type { LayoutEntry, Meta } from "../../schema/meta.js";
