import { configDefaults, defineConfig } from 'vitest/config'
import { createRequire } from 'node:module'

// typesugar (case study). neverthrow ships no vitest config; this one only
// adds typesugar's Vite plugin, so the tests (and the src modules they
// import) are expanded by typesugar before Vite's esbuild compiles them.
// unplugin-typesugar is a dependency of the case-study package, so resolve
// it from there. tests/tsconfig.tests.json is the tsconfig the type tests use.
const caseStudyRequire = createRequire(new URL('./case-study/package.json', import.meta.url))
const typesugarVite = caseStudyRequire('unplugin-typesugar/vite')
const typesugar = typesugarVite.default ?? typesugarVite

export default defineConfig({
  plugins: [typesugar({ tsconfig: './tests/tsconfig.tests.json' })],
  // The consumer project (case-study/consumer/) runs its own tests with its
  // own configs; keep it out of neverthrow's suite.
  test: { exclude: [...configDefaults.exclude, 'case-study/**'] },
})
