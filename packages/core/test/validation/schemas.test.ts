import { describe, expect, it } from "vitest";

import { archnautFileSchema } from "../../src/validation/schemas/archnaut-file.schema.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

describe("Zod schemas", () => {
  it("parses the shop platform fixture", () => {
    const result = archnautFileSchema.safeParse(shopPlatformFixture);
    expect(result.success).toBe(true);
  });

  it("rejects invalid enum values", () => {
    const invalid = {
      ...shopPlatformFixture,
      nodes: [
        {
          ...shopPlatformFixture.nodes[0]!,
          status: "done",
        },
      ],
    };
    const result = archnautFileSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level keys", () => {
    const invalid = { ...shopPlatformFixture, extra: true };
    const result = archnautFileSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
