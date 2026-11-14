// The same project compiled with typesugar: the plain tests again, plus the
// tests of code written with typesugar syntax.
import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const require = createRequire(new URL("../package.json", import.meta.url));
const vite = require("unplugin-typesugar/vite");
const typesugar = vite.default ?? vite;

export default defineConfig({
  plugins: [typesugar({ tsconfig: "./tsconfig.json" })],
  test: { include: ["tests/plain/**/*.test.ts", "tests/typesugar/**/*.test.ts"] },
});
