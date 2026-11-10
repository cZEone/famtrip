// ESLint flat config: Next.js recommended rules (React, hooks, accessibility basics,
// Core Web Vitals) plus a few extra checks that catch real bugs.
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", ".vercel/**", "docs/**"] },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Test files and the Claude hook script run in Node.
    files: ["tests/**", ".claude/hooks/**", "*.config.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
    rules: { "no-console": "off" },
  },
];

export default config;
