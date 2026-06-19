import type { ArchnautFileV1 } from "../../src/validation/schemas/archnaut-file.schema.js";

export const shopPlatformFixture: ArchnautFileV1 = {
  version: 1,
  project: {
    id: "repo.shop-platform",
    name: "Shop Platform",
    root: ".",
    packageManager: "pnpm",
    monorepo: true,
  },
  workspaces: [
    { id: "ws.web", name: "web", path: "apps/web", kind: "app" },
    { id: "ws.api", name: "api", path: "apps/api", kind: "app" },
    { id: "ws.shared", name: "shared", path: "packages/shared", kind: "package" },
  ],
  nodes: [
    {
      id: "cmp.web.storefront",
      name: "Storefront UI",
      workspaceId: "ws.web",
      kind: "component",
      status: "implemented",
      files: ["apps/web/src/pages/Home.tsx"],
    },
    {
      id: "cmp.api.catalog",
      name: "Catalog Service",
      workspaceId: "ws.api",
      kind: "component",
      status: "implemented",
      files: ["apps/api/src/modules/catalog"],
    },
    {
      id: "cmp.api.checkout",
      name: "Checkout Service",
      workspaceId: "ws.api",
      kind: "component",
      status: "implemented",
      files: ["apps/api/src/modules/checkout"],
    },
    {
      id: "pkg.shared.types",
      name: "Shared Types",
      workspaceId: "ws.shared",
      kind: "component",
      status: "implemented",
      files: ["packages/shared/src/types.ts"],
    },
    {
      id: "ext.stripe",
      name: "Stripe",
      kind: "external",
      status: "implemented",
      files: [],
    },
    {
      id: "cmp.api.recommendations",
      name: "Recommendations Service",
      workspaceId: "ws.api",
      kind: "component",
      status: "planned",
      files: [],
      metadata: {
        description: "Planned recommendation engine for product suggestions.",
      },
    },
  ],
  edges: [
    {
      id: "edge.web.storefront-api.catalog-calls",
      from: "cmp.web.storefront",
      to: "cmp.api.catalog",
      type: "calls",
      status: "implemented",
    },
    {
      id: "edge.web.storefront-api.checkout-calls",
      from: "cmp.web.storefront",
      to: "cmp.api.checkout",
      type: "calls",
      status: "implemented",
    },
    {
      id: "edge.api.catalog-shared.types-depends_on",
      from: "cmp.api.catalog",
      to: "pkg.shared.types",
      type: "depends_on",
      status: "implemented",
    },
    {
      id: "edge.api.checkout-stripe-calls",
      from: "cmp.api.checkout",
      to: "ext.stripe",
      type: "calls",
      status: "implemented",
    },
    {
      id: "edge.api.catalog-api.recommendations-calls",
      from: "cmp.api.catalog",
      to: "cmp.api.recommendations",
      type: "calls",
      status: "planned",
    },
  ],
  concerns: [
    {
      id: "concern.recommendations-source",
      scope: "cmp.api.recommendations",
      severity: "medium",
      status: "open",
      source: "human",
      description:
        "Need to decide whether recommendations are batch-generated or request-time.",
    },
  ],
  meta: {
    createdBy: "archnaut",
    schemaVersion: "1.0.0",
    lastNormalizedAt: "2026-06-19T00:09:00Z",
    layout: {},
  },
};
