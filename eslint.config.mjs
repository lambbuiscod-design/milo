import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    ".next-e2e-dev/**",
    "apps/*/.next/**",
    "apps/*/.next-e2e/**",
    "apps/*/.next-e2e-dev/**",
    "apps/*/.vite/**",
    "apps/*/out/**",
    "apps/*/make/**",
    "native/**/bin/**",
    "native/**/obj/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
