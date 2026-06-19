import { describe, expect, it } from "vitest";

import { endpointSlug } from "../../src/ids/endpoint-slug.js";
import { generateEdgeId } from "../../src/ids/generate-edge-id.js";
import { generateNodeId } from "../../src/ids/generate-node-id.js";
import { generateWorkspaceId } from "../../src/ids/generate-workspace-id.js";
import { parseEdgeId } from "../../src/ids/parse-edge-id.js";
import { parseNodeId } from "../../src/ids/parse-node-id.js";
import { edgeTypeSchema } from "../../src/validation/schemas/enums.schema.js";

function matchLongestEdgeTypeSuffix(body: string, types: readonly string[]): string | undefined {
  const sorted = [...types].sort((a, b) => b.length - a.length || a.localeCompare(b));
  for (const type of sorted) {
    const suffix = `-${type}`;
    if (body.endsWith(suffix)) {
      return type;
    }
  }
  return undefined;
}

describe("ID helpers", () => {
  it("parses component and package node ids", () => {
    expect(parseNodeId("cmp.api.checkout")).toEqual({
      kindPrefix: "cmp",
      workspaceSlug: "api",
      name: "checkout",
      raw: "cmp.api.checkout",
    });
    expect(parseNodeId("pkg.shared.types")).toEqual({
      kindPrefix: "pkg",
      workspaceSlug: "shared",
      name: "types",
      raw: "pkg.shared.types",
    });
  });

  it("generates cmp vs pkg component ids", () => {
    expect(
      generateNodeId({
        kind: "component",
        workspaceId: "ws.api",
        workspaceKind: "app",
        slug: "checkout",
      }),
    ).toBe("cmp.api.checkout");

    expect(
      generateNodeId({
        kind: "component",
        workspaceId: "ws.shared",
        workspaceKind: "package",
        slug: "types",
      }),
    ).toBe("pkg.shared.types");
  });

  it("generates deterministic edge ids from endpoint tails and type", () => {
    expect(generateEdgeId("cmp.api.checkout", "ext.stripe", "calls")).toBe(
      "edge.api.checkout-stripe-calls",
    );
    expect(generateEdgeId("cmp.web.storefront", "cmp.api.catalog", "calls")).toBe(
      "edge.web.storefront-api.catalog-calls",
    );
  });

  it("returns the same edge id for the same triple on repeated calls", () => {
    const first = generateEdgeId("cmp.api.checkout", "ext.stripe", "calls");
    const second = generateEdgeId("cmp.api.checkout", "ext.stripe", "calls");
    expect(first).toBe(second);
  });

  it("distinguishes node pairs that shared last-segment slugs", () => {
    const apiCheckout = generateEdgeId("cmp.api.checkout", "ext.stripe", "calls");
    const webCheckout = generateEdgeId("cmp.web.checkout", "ext.stripe", "calls");
    expect(apiCheckout).toBe("edge.api.checkout-stripe-calls");
    expect(webCheckout).toBe("edge.web.checkout-stripe-calls");
    expect(apiCheckout).not.toBe(webCheckout);
  });

  it("parses generated edge ids with type suffix", () => {
    expect(parseEdgeId("edge.api.checkout-stripe-calls")).toEqual({
      slug: "api.checkout-stripe",
      type: "calls",
      raw: "edge.api.checkout-stripe-calls",
    });
    expect(parseEdgeId("edge.api.catalog-shared.types-depends_on")).toEqual({
      slug: "api.catalog-shared.types",
      type: "depends_on",
      raw: "edge.api.catalog-shared.types-depends_on",
    });
  });

  it("parses legacy edge ids without type suffix", () => {
    expect(parseEdgeId("edge.web-catalog")).toEqual({
      slug: "web-catalog",
      raw: "edge.web-catalog",
    });
  });

  it("round-trips every edge type through generateEdgeId and parseEdgeId", () => {
    for (const type of edgeTypeSchema.options) {
      const id = generateEdgeId("cmp.api.checkout", "ext.stripe", type);
      expect(parseEdgeId(id)).toEqual({
        slug: "api.checkout-stripe",
        type,
        raw: id,
      });
    }
  });

  it("prefers the longest matching edge type suffix when names overlap", () => {
    const overlappingTypes = ["calls", "recalls"];
    expect(matchLongestEdgeTypeSuffix("foo-recalls", overlappingTypes)).toBe("recalls");
    expect(matchLongestEdgeTypeSuffix("foo-recalls", ["calls", "recalls"])).not.toBe("calls");
  });

  it("generates workspace ids", () => {
    expect(generateWorkspaceId("Web App")).toBe("ws.web-app");
  });
});

describe("endpointSlug", () => {
  it("derives structural tails for parseable node ids", () => {
    expect(endpointSlug("cmp.api.checkout")).toBe("api.checkout");
    expect(endpointSlug("ext.stripe")).toBe("stripe");
  });

  it("derives fallback tails by dropping the unknown kind prefix", () => {
    expect(endpointSlug("legacy.api.checkout")).toBe("api.checkout");
    expect(endpointSlug("orphan")).toBe("orphan");
  });

  it("returns stable edge ids for legacy node ids across repeated calls", () => {
    const first = generateEdgeId("legacy.api.checkout", "ext.stripe", "calls");
    const second = generateEdgeId("legacy.api.checkout", "ext.stripe", "calls");
    expect(first).toBe("edge.api.checkout-stripe-calls");
    expect(first).toBe(second);
  });

  it("matches cmp edge ids when legacy ids share the same tail shape", () => {
    const legacy = generateEdgeId("legacy.api.checkout", "ext.stripe", "calls");
    const cmp = generateEdgeId("cmp.api.checkout", "ext.stripe", "calls");
    expect(legacy).toBe(cmp);
    expect(legacy).toBe("edge.api.checkout-stripe-calls");
  });
});
