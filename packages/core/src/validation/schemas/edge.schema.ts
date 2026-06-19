import { z } from "zod";
import { edgeStatusSchema, edgeTypeSchema } from "./enums.schema.js";

export const edgeMetadataSchema = z
  .object({
    description: z.string().optional(),
  })
  .catchall(z.unknown())
  .optional();

export const edgeSchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    type: edgeTypeSchema,
    status: edgeStatusSchema,
    metadata: edgeMetadataSchema,
  })
  .strict();

export type EdgeMetadata = NonNullable<z.infer<typeof edgeMetadataSchema>>;
export type Edge = z.infer<typeof edgeSchema>;
