// Claude Code PostToolUse hook: after Claude edits or writes a file,
//   1. lint that file with ESLint (JS/MJS/JSX only), and
//   2. if it's API code or a test, run the test suite.
// On failure it prints the problems to stderr and exits 2, which Claude Code
// feeds back to Claude so it fixes them before moving on.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Project root = two folders up from this script (.claude/hooks/check.mjs).
// Derived from the script's own location so it works whatever path style the shell uses.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Read the hook payload from stdin as a stream (readFileSync(0) is unreliable on Windows pipes).
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try {
  input = JSON.parse(raw || "{}");
} catch {
  process.exit(0); // invalid payload → nothing to check
}

const file = input.tool_input?.file_path || input.tool_response?.filePath;
if (!file) process.exit(0);

const abs = path.resolve(root, file);
const rel = path.relative(root, abs).split(path.sep).join("/");
const outside = rel.startsWith("..") || path.isAbsolute(rel);
if (outside || /^(node_modules|\.next|\.vercel)\//.test(rel) || !/\.(m?js|jsx)$/.test(rel)) process.exit(0);

const run = (args) => spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
const problems = [];

// 1. ESLint on just this file
const lint = run([path.join(root, "node_modules/eslint/bin/eslint.js"), "--max-warnings=0", abs]);
if (lint.status !== 0) problems.push(`ESLint found problems in ${rel}:\n${(lint.stdout + lint.stderr).trim()}`);

// 2. Tests, when the API code or the tests themselves changed
if (/^(lib\/api|tests)\//.test(rel)) {
  const test = run(["--test", "tests/**/*.test.mjs"]);
  if (test.status !== 0) {
    const out = (test.stdout + test.stderr).split("\n");
    const failing = out
      .filter((l) => !/^\s*✔/.test(l) && /^\s*(✖|not ok)|AssertionError|Error:|expected|actual/.test(l))
      .slice(0, 40)
      .join("\n");
    problems.push(`Tests failed after editing ${rel}:\n${failing || out.slice(-40).join("\n")}`);
  }
}

if (problems.length) {
  process.stderr.write(problems.join("\n\n") + "\n");
  process.exit(2);
}
