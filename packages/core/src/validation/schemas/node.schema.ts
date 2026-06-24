import { z } from "zod";

import type { Node, NodeMetadata } from "../../schema/node.js";
import { nodeKindSchema, nodeLayerSchema, nodeStatusSchema } from "./enums.schema.js";

const nodeMetadataObjectSchema = z
  .object({
    description: z.string().optional(),
  })
  .catchall(z.unknown()) satisfies z.ZodType<NodeMetadata>;

export const nodeMetadataSchema = nodeMetadataObjectSchema.optional();

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
  .strict() satisfies z.ZodType<Node>;

export type { Node, NodeMetadata } from "../../schema/node.js";
