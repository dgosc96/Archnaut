import { describe, expect, it } from "vitest";

import { validateArchnautFile } from "../../src/validation/validate-archnaut-file.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

describe("validateArchnautFile", () => {
  it("accepts the shop platform fixture", () => {
    const result = validateArchnautFile(shopPlatformFixture);
    expect(result.ok).toBe(true);
  });

  it("collects multiple errors without stopping early", () => {
    const invalid = {
      ...shopPlatformFixture,
      nodes: [
        ...shopPlatformFixture.nodes,
        {
          id: "ext.with-ws",
          name: "Bad External",
          workspaceId: "ws.missing",
          kind: "external",
          status: "implemented",
          files: [],
        },
        {
          id: "cmp.api.checkout",
          name: "Duplicate Checkout",
          workspaceId: "ws.api",
          kind: "component",
          status: "implemented",
          files: [],
        },
      ],
      edges: [
        ...shopPlatformFixture.edges,
        {
          id: "edge.self-loop",
          from: "cmp.api.catalog",
          to: "cmp.api.catalog",
          type: "calls",
          status: "implemented",
        },
        {
          id: "edge.missing-target",
          from: "cmp.api.catalog",
          to: "cmp.does.not.exist",
          type: "calls",
          status: "implemented",
        },
      ],
    };

    const result = validateArchnautFile(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(1);
      const codes = new Set(result.issues.map((i) => i.code));
      expect(codes.has("DUPLICATE_ID")).toBe(true);
      expect(codes.has("MISSING_REFERENCE")).toBe(true);
      expect(codes.has("CONSTRAINT_VIOLATION")).toBe(true);
    }
  });

  it("rejects unsupported version", () => {
    const result = validateArchnautFile({ ...shopPlatformFixture, version: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "INVALID_VERSION")).toBe(true);
    }
  });

  it("reports duplicate node ids", () => {
    const node = shopPlatformFixture.nodes[0]!;
    const invalid = {
      ...shopPlatformFixture,
      nodes: [node, { ...node }],
    };
    const result = validateArchnautFile(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "DUPLICATE_ID")).toBe(true);
    }
  });

  it("warns on orphan layout but still validates", () => {
    const invalid = {
      ...shopPlatformFixture,
      meta: {
        ...shopPlatformFixture.meta,
        layout: { "cmp.missing.node": { x: 1, y: 2 } },
      },
    };
    const result = validateArchnautFile(invalid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings?.some((w) => w.code === "ORPHAN_LAYOUT")).toBe(true);
    }
  });
});
