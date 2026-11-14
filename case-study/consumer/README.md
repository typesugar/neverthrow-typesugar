# Consumer project (Stage 1)

A small project that uses neverthrow the way an app would, built two ways:
plain TypeScript, and with typesugar. See `CASE-STUDY.md`, Stage 1.

- `src/pipeline.ts`: plain neverthrow, with no typesugar syntax.
- `src/sugar.ts`: the same functions with `let:`/`yield:` and `match()`, which only compile with typesugar.
- `tests/plain/` runs under both configs; `tests/typesugar/` only under typesugar's.

neverthrow is installed from an `npm pack` tarball of this repo
(`.pack/neverthrow.tgz`, not committed). typesugar, vitest and TypeScript 5.9
resolve from `../node_modules` (the case-study package) and
`../../node_modules` (neverthrow's own devDependencies).

```sh
npm ci && npm --prefix case-study ci   # once, at the repo root
npm run build                          # at the repo root: neverthrow's dist/
cd case-study/consumer
npm run pack-neverthrow                # pack dist/ and install it here
npm run test:plain                     # plain config: tests/plain
npm run test:typesugar                 # typesugar config: tests/plain + tests/typesugar
npm run check:typesugar                # typesugar check on the whole project
node timings.mjs --runs 5              # plain vs typesugar cost, interleaved
../node_modules/.bin/typesugar expand src/sugar.ts -p tsconfig.json
```

The benchmark (`bench/`, CASE-STUDY.md Stage 2) compiles `bench/cases.ts`
ahead of time with typesugar, then times it in fresh processes:

```sh
../node_modules/.bin/typesugar build -p bench/tsconfig.json   # → bench/out/cases.js
node bench/run.mjs [--pollute]                                # one process
node bench/rounds.mjs --rounds 5 --out ../results/stage-2/consumer-bench.json
```
