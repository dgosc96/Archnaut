import { describe, expect, it, vi } from "vitest";

import { normalizeArchnautFile } from "../../src/normalize/normalize-archnaut-file.js";
import { serializeArchnautFile } from "../../src/normalize/serialize.js";
import { shopPlatformFixture } from "../fixtures/shop-platform.js";

describe("normalizeArchnautFile", () => {
  it("sorts top-level arrays by id", () => {
    const shuffled = {
      ...shopPlatformFixture,
      nodes: [...shopPlatformFixture.nodes].reverse(),
      edges: [...shopPlatformFixture.edges].reverse(),
    };
    const normalized = normalizeArchnautFile(shuffled);
    const nodeIds = normalized.nodes.map((n) => n.id);
    expect(nodeIds).toEqual([...nodeIds].sort());
  });

  it("dedupes and sorts nested string arrays", () => {
    const file = {
      ...shopPlatformFixture,
      nodes: shopPlatformFixture.nodes.map((node, index) =>
        index === 0
          ? { ...node, files: ["b.ts", "a.ts", "a.ts"] }
          : node,
      ),
    };
    const normalized = normalizeArchnautFile(file);
    const storefront = normalized.nodes.find((n) => n.id === "cmp.web.storefront");
    expect(storefront!.files).toEqual(["a.ts", "b.ts"]);
  });

  it("strips orphan layout entries", () => {
    const file = {
      ...shopPlatformFixture,
      meta: {
        ...shopPlatformFixture.meta,
        layout: {
          "cmp.api.catalog": { x: 10, y: 20 },
          "cmp.ghost": { x: 1, y: 1 },
        },
      },
    };
    const normalized = normalizeArchnautFile(file);
    expect(normalized.meta.layout).toEqual({ "cmp.api.catalog": { x: 10, y: 20 } });
  });

  it("updates lastNormalizedAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T12:00:00.000Z"));
    const normalized = normalizeArchnautFile(shopPlatformFixture);
    expect(normalized.meta.lastNormalizedAt).toBe("2026-06-19T12:00:00.000Z");
    vi.useRealTimers();
  });
});

describe("serializeArchnautFile", () => {
  it("produces byte-identical output for logically equal input", () => {
    const a = normalizeArchnautFile({
      ...shopPlatformFixture,
      nodes: [...shopPlatformFixture.nodes].reverse(),
    });
    const b = normalizeArchnautFile({
      ...shopPlatformFixture,
      edges: [...shopPlatformFixture.edges].reverse(),
    });
    const bytesA = serializeArchnautFile(a);
    const bytesB = serializeArchnautFile(b);
    expect(bytesA).toBe(bytesB);
    expect(bytesA.endsWith("\n")).toBe(true);
  });
});
