#!/usr/bin/env node
// Stage 0 check for the tests: run the vitest suite with the same typesugar
// Vite plugin as vitest.config.mjs, but with its transform wrapped to record
// which modules it saw and whether it changed any. Prints the record after
// the run; the suite's own result is printed by vitest as usual.
//
//   node case-study/experiments/stage-0-vitest-trace.mjs
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startVitest } from 'vitest/node'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
process.chdir(repo)
const csRequire = createRequire(path.join(repo, 'case-study/package.json'))
const mod = csRequire('unplugin-typesugar/vite')
const typesugarVite = mod.default ?? mod

const plugin = typesugarVite({ tsconfig: './tests/tsconfig.tests.json' })
const calls = []
const inner = plugin.transform
const fn = typeof inner === 'function' ? inner : inner.handler
const wrapped = async function (code, id, ...rest) {
  const included = plugin.transformInclude ? plugin.transformInclude(id) : true
  const out = await fn.call(this, code, id, ...rest)
  calls.push({ id: path.relative(repo, id.split('?')[0]), included, changed: out != null })
  return out
}
plugin.transform = typeof inner === 'function' ? wrapped : { ...inner, handler: wrapped }

const vitest = await startVitest('test', [], { config: false, watch: false }, { plugins: [plugin] })
await vitest?.close()
console.log('\ntypesugar transform calls (vitest):')
for (const c of calls)
  console.log(
    `  ${c.id}: ${c.included ? (c.changed ? 'CHANGED' : 'passed through') : 'not included'}`,
  )
const seen = calls.filter((c) => c.included)
console.log(
  `${seen.length} modules seen by typesugar, ${seen.filter((c) => c.changed).length} changed`,
)
