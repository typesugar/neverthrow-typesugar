// Plain TypeScript: no typesugar. Runs only the tests of plain neverthrow code.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/plain/**/*.test.ts"] },
});
