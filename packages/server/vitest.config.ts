import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// ponytail: alias avoids requiring `pnpm --filter @archnaut/core build` before server tests
const coreSrc = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../core/src/index.ts",
);

export default defineConfig({
  resolve: {
    alias: {
      "@archnaut/core": coreSrc,
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
