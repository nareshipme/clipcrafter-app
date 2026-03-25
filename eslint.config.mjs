import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",           // remotion render scripts
    "**/__tests__/**",      // test files are more lenient
    "**/*.test.ts",
    "**/*.test.tsx",
  ]),

  {
    rules: {
      // ─── Vibe-coding safety rules ───────────────────────────────────

      // No file over 500 lines — forces splitting components/functions
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],

      // No function over 80 lines — forces small focused functions
      "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],

      // No deeply nested code (max 4 levels) — forces early returns
      "max-depth": ["error", 4],

      // No functions with too many params — forces objects/destructuring
      "max-params": ["warn", 4],

      // No unused variables (prefix with _ to intentionally ignore)
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],

      // No explicit any — forces proper typing
      "@typescript-eslint/no-explicit-any": "warn",

      // No console.log left in committed code (use logger instead)
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // React hooks — always declare deps correctly
      "react-hooks/exhaustive-deps": "warn",

      // No duplicate imports
      "no-duplicate-imports": "error",

      // Always use === not ==
      "eqeqeq": ["error", "always"],

      // No var — use const/let only
      "no-var": "error",

      // Prefer const where variable is never reassigned
      "prefer-const": "error",

      // No dead code
      "no-unreachable": "error",

      // No TODO comments left in production code (warn so you notice)
      "no-warning-comments": ["warn", { terms: ["todo", "fixme", "hack", "xxx"], location: "start" }],

      // Complexity limit — no spaghetti logic
      "complexity": ["warn", 10],
    },
  },

  // ─── Relaxed rules for API route files (more complex by nature) ───
  {
    files: ["src/inngest/**/*.ts", "src/app/api/**/*.ts"],
    rules: {
      "max-lines-per-function": "off", // Inngest steps are long by design
      "no-console": "off",             // Server logs are fine in API/worker code
    },
  },
]);

export default eslintConfig;
