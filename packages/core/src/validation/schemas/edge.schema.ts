import { z } from "zod";

import type { Edge, EdgeMetadata } from "../../schema/edge.js";
import { edgeStatusSchema, edgeTypeSchema } from "./enums.schema.js";

const edgeMetadataObjectSchema = z
  .object({
    description: z.string().optional(),
  })
  .catchall(z.unknown()) satisfies z.ZodType<EdgeMetadata>;

export const edgeMetadataSchema = edgeMetadataObjectSchema.optional();

export const edgeSchema: z.ZodType<Edge> = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    type: edgeTypeSchema,
    status: edgeStatusSchema,
    metadata: edgeMetadataSchema,
  })
  .strict();

export type { Edge, EdgeMetadata } from "../../schema/edge.js";
