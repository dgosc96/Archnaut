import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const packageLintTargets = [
  {
    basePath: "packages/core",
    files: ["src/**/*.ts", "test/**/*.ts"],
  },
  // future: { basePath: "packages/cli", files: ["src/**/*.ts", "test/**/*.ts"] },
];

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  ...packageLintTargets.map(({ basePath, files }) => ({
    basePath,
    files,
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  })),
);
