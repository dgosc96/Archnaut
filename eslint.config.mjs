import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";

const jsdocPluginRules = {
  plugins: { jsdoc },
  rules: {
    "jsdoc/require-jsdoc": [
      "warn",
      {
        publicOnly: true,
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
      },
    ],
    "jsdoc/require-param": "warn",
    "jsdoc/require-returns": "warn",
    "jsdoc/require-throws": "warn",
    "jsdoc/check-param-names": "warn",
    "jsdoc/no-types": "warn",
    "jsdoc/require-throws-type": "off",
    "jsdoc/tag-lines": "off",
  },
};

const typescriptLintBase = [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
];

const typescriptLintWithJsdoc = [
  ...typescriptLintBase,
  jsdoc.configs["flat/recommended-typescript"],
];

const packageLintTargets = [
  { basePath: "packages/core" },
  { basePath: "packages/server" },
  // future: { basePath: "packages/cli" },
];

export default defineConfig(
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  ...packageLintTargets.flatMap(({ basePath }) => [
    {
      basePath,
      files: ["src/**/*.ts"],
      extends: typescriptLintWithJsdoc,
      ...jsdocPluginRules,
    },
    {
      basePath,
      files: ["test/**/*.ts"],
      extends: typescriptLintBase,
    },
  ]),
);
