import { z } from "zod";
import { nodeKindSchema, nodeLayerSchema, nodeStatusSchema } from "./enums.schema.js";

export const nodeMetadataSchema = z
  .object({
    description: z.string().optional(),
  })
  .catchall(z.unknown())
  .optional();

export const nodeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    workspaceId: z.string().optional(),
    kind: nodeKindSchema,
    status: nodeStatusSchema,
    files: z.array(z.string()),
    tags: z.array(z.string()).optional(),
    tech: z.array(z.string()).optional(),
    layer: nodeLayerSchema.optional(),
    metadata: nodeMetadataSchema,
  })
  .strict();

export type NodeMetadata = NonNullable<z.infer<typeof nodeMetadataSchema>>;
export type Node = z.infer<typeof nodeSchema>;
