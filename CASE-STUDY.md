# neverthrow × typesugar: a case study

This fork of [neverthrow](https://github.com/supermacro/neverthrow) (MIT,
v8.2.0) is the second proof point for [typesugar](https://typesugar.org),
after the [Turf study](https://github.com/typesugar/turf-typesugar). We
refactor a real, widely used TypeScript library in stages using typesugar's
macros, and measure whether "zero cost" holds. It is a one-off study, not a
maintained fork; all credit for neverthrow itself goes to its authors.

Branch: `typesugar-case-study`, from tag `v8.2.0` (1d4cc19). Local only so
far: no public fork yet.

## Why neverthrow

Turf exercised derive, type guards and `match()` on string literals. It did
not touch typesugar's functional side. neverthrow is that side's natural
target: `Result<T, E>` is a union of two classes, `Ok` and `Err`, with
`map`, `andThen`, `mapErr`, `match` and friends, plus `ResultAsync` and
`safeTry`, a generator-based do-notation. These map onto typesugar's fp
`Either`/`Result`, `@adt`, do-notation, `match()` extractors and
return-type specialisation.

neverthrow's own names, `Result`, `Ok`, `Err`, `ok` and `err`, are the names
typesugar's built-in tables key on. PEP-062 ("match by type, not by name")
lists these tables as debt; this study is where they meet a real library
with the same names but a different representation (class instances with
`.value` / `.error`, no tag field).

## Questions we want answered

1. With typesugar in the build and no source changes, is the output identical?
2. For each feature we adopt, what happens to bundle size, runtime
   performance (our Result-chain benchmark; neverthrow ships none), build time
   and type-check time?
3. Where does typesugar's generated code differ from what a person would
   write by hand, and why?
4. Does typesugar resolve neverthrow's `Result`/`Ok`/`Err` by type, or does it
   confuse them with its own by name?
5. What did adopting it cost: lines changed, friction, bugs found in
   typesugar, features that didn't fit?

## Ground rules

- **neverthrow's public API and its tests are the spec.** `tests/*.test.ts`
  and the type tests (`tests/typecheck-tests.ts`, run by `npm run
  test-types`) are not changed to make a stage pass. New tests may be added.
  A stage that needs a test change says why, in the stage log.
- **The class API stays.** Users rely on `instanceof Ok` / `instanceof Err`
  and on the methods being on the instances, so `Ok` and `Err` stay classes.
  typesugar can change how neverthrow is implemented and how code that uses
  it is compiled, not what a `Result` is at runtime.
- **The published types stay.** `dist/index.d.ts` changes only by additions
  the stage log names, and `attw --pack` (part of `npm run build`) still
  passes.
- **Every stage is measured against the stage before it and against v8.2.0.**
- **typesugar bugs found here are fixed in typesugar** (failing test first) on
  typesugar branch `neverthrow-case-study-fixes`, and logged below. The fork
  never patches around a typesugar bug silently.
- **typesugar is consumed as packed tarballs** (`vendor/typesugar/*.tgz`)
  built from a recorded typesugar commit, so anyone can reproduce a stage
  without local links (`vendor/typesugar/README.md`).
- **neverthrow's TypeScript stays at 4.7.2** for its own build, type check and
  type tests. typesugar runs on its own TypeScript 5.9.3 (F1). If a stage
  needs neverthrow's TypeScript upgraded, the stage log says so and why.

## Measurements (per stage)

| Metric | How |
| --- | --- |
| Tests | `npm test` (vitest, then the type tests with `tsc`); `npm run typecheck`; `npm run lint` |
| Runtime | `case-study/bench/result-chains.mjs`, A/B against the previous stage and v8.2.0 with `case-study/bench-ab.mjs`: each side built in its own worktree, a fresh process per side per round, order alternating A,B / B,A, median ops/sec of N rounds (default 5) with spread (min–max and IQR) and delta % |
| Bundle size | `dist/index.es.js`, `dist/index.cjs.js`, `dist/index.d.ts`: raw, gzip -9, brotli q11 (`case-study/size.mjs`) |
| Emitted code | Diff of `dist/` against the previous stage; every residual typesugar runtime reference is listed and explained |
| Build / test time | `npm run build`, `npx vitest run`, `npm run test-types`, interleaved A/B, median of 3, with max RSS (`case-study/timings.mjs`) |
| Adoption cost | Lines changed in source, new imports, friction notes |

The benchmark loads each side's built `dist/index.cjs.js` (what Node resolves
for both `require` and `import` of neverthrow), so both sides run the same
bench file, no TypeScript is compiled in the bench process, and typesugar's
Node loader is never involved (Turf finding F7 doesn't apply). Each task runs
a batch over 1,000 fixed inputs from a seeded generator (Turf F6). Two
"reference:" tasks implement the same pipeline as hand-written tagged objects
without neverthrow: they are identical on both sides, so their delta is the
run's noise floor, and they show what a person would write without the
classes.

Runtime numbers come from local interleaved runs on one stated machine. Each
result file records the CPU, Node version, date and the load average at the
start and end of the run, and flags every delta smaller than its spread. The
numbers are comparable only within one run. Readers re-run `node
case-study/bench-ab.mjs --a <ref> --b <ref>` on their own machine rather than
comparing against ours.

## Stages (proposed; each is one PR on the fork)

0. **Integration, no source changes.** unplugin-typesugar in the Rollup build
   (before `rollup-plugin-typescript2`) and in vitest (neverthrow has no
   vitest config, so one is added), plus the benchmark. Expected: `dist/`
   byte-identical to v8.2.0, tests identical. **Done**, see the log.
1. **Typeclass instances for neverthrow's `Result`.** Give `Result<T, E>`
   `@impl` instances of typesugar's `Functor`/`Monad`/`MonadError` (and
   `Destructure` once PEP-008 Wave 11 lands), in neverthrow's own source,
   so typesugar's generic features can treat it as a first-class type.
   This is the first PEP-062 test: does resolution pick neverthrow's instance
   for neverthrow's `Result` while fp's `Result`/`Either` exist under the same
   names? Instances are runtime objects, so either they ship in `dist/` (a
   size cost we measure) or they live in a separate entry point; the stage
   decides which.
2. **`match()` over `Result`**, in neverthrow's internals (`combineResultList`
   and friends branch on `isOk()`) and in new tests written as user code:
   `match(r).case(Ok(v))....case(Err(e))...`. Expect bugs here: `match()`'s
   extractor tables know `Ok`/`Err` by name and probe for `ok`/`_tag` fields
   (PEP-062 row 1), and neverthrow's `Ok` has neither, only `.value` and an
   `isOk()` method.
3. **Do-notation in place of `safeTry`.** typesugar's do-notation over
   neverthrow's `Result` (through Stage 1's `Monad`), compiled to the plain
   `andThen` chain, compared with `safeTry` generators. Stage 0's benchmark
   puts a two-step `safeTry` at about 26 times the cost of the same chain
   written with `andThen` (F5), so this is the stage with a measurable
   runtime claim. Users write `safeTry`, not neverthrow's internals, so this
   lands as new tests and bench cases, and in the library only where it uses
   `safeTry` itself.
4. **`ok`/`err` and return-type specialisation.** typesugar's return-type
   specialisation and fp's `ok`/`err` macros pick the result algebra by type
   name today (PEP-062 row 10; `fp/src/zero-cost/macros.ts` matches any
   `Result.<method>(...)` call by the identifier's text, and neverthrow has
   `Result.combine` and `Result.fromThrowable`). Test that a file using both
   neverthrow and typesugar keeps neverthrow's semantics, then see whether
   `fromThrowable`-style wrappers can compile to inline `try`/`catch`.
5. **`ResultAsync` and extension methods.** Extension methods on `Result` and
   `ResultAsync` (Turf's unexercised Stage 5), and whether typesugar's
   generic extension receivers (PR #86's open decision) mistake neverthrow's
   `Result` for fp's.

Not planned: replacing the classes with an `@adt` tagged union or an
`@opaque` representation. That is what typesugar would do for a new library,
but it breaks `instanceof` (ground rules). If Stages 1–3 show the class cost is
material, a side experiment can measure an `@adt` version against the
`reference:` bench tasks without shipping it.

Stages 1–5 may be reordered or cut based on what each one teaches; the log
records why.

## Stage log

### Stage 0: integration, no source changes

**Result: byte-identical.** With typesugar in the build, `dist/index.es.js`,
`dist/index.cjs.js` and `dist/index.d.ts` are byte-identical to v8.2.0
(SHA-256 in `case-study/results/stage-0/dist-sha256.txt`), both in this
checkout and in clean worktree builds of each side. All 117 vitest tests pass
through typesugar, and the type tests, `typecheck` and `lint` pass as before.

typesugar: `origin/main` at
[`86bcf8c7`](https://github.com/typesugar/typesugar/commit/86bcf8c7) (PR #86
merged), vendored as tarballs in `vendor/typesugar/`. No typesugar change was
needed.

What changed in the fork (no file under `src/` or `tests/` changed):

- `rollup.config.mjs`: `unplugin-typesugar/rollup` before
  `rollup-plugin-typescript2` in both JS builds (ES and CJS). The plugin runs
  with `enforce: "pre"` and returns a module only when expansion changed it;
  otherwise rpt2 compiles the file as before. The `.d.ts` bundling step
  (`rollup-plugin-dts` over rpt2's declarations) is untouched.
- `vitest.config.mjs` (new; neverthrow had none): only `unplugin-typesugar/vite`,
  with the tests' tsconfig (`tests/tsconfig.tests.json`).
- `case-study/package.json` and its `package-lock.json`: a separate npm
  project holding the typesugar tarballs and TypeScript 5.9.3, with
  `overrides` so every `@typesugar/*` dependency resolves to a tarball. The
  root `package.json` and `package-lock.json` are unchanged from v8.2.0.
  Install with `npm ci && npm --prefix case-study ci`.
- `vendor/typesugar/`: tarballs, `COMMIT`, `pack.sh` (adapted from Turf's,
  plus the F2 fix) and a README.
- `case-study/bench/result-chains.mjs` (the benchmark),
  `case-study/bench-ab.mjs` (A/B runner), `case-study/timings.mjs`,
  `case-study/size.mjs`, and two trace experiments under
  `case-study/experiments/`.

How we know typesugar ran: a byte-identical `dist/` would also come from a
plugin that never ran. The plugin's `verbose` option only logs modules it
changes (F6), so two experiments wrap the plugin's `transform` and record
each call:

- `stage-0-plugin-trace.mjs` builds `src/index.ts` with the Rollup config's
  plugins: typesugar saw all 5 neverthrow modules and passed each through
  unchanged (`tslib` was excluded by the default filter). The same plugin
  instance expanded a positive control, a module with
  `comptime(() => 6 * 7)`, to `export const answer = 42`.
- `stage-0-vitest-trace.mjs` runs the suite with the same Vite plugin: 7
  modules (2 test files, 5 source files) seen, 0 changed, 117 tests passed.

Results are in `case-study/results/stage-0/`.

Numbers (Apple M5 Pro, 18 cores, 64 GB, Node 22.23.2, npm 10.9.8; shared and
busy machine, load average 13–18):

| | v8.2.0 | Stage 0 |
| --- | --- | --- |
| `npm run build` (median of 3) | 1.47 s, 328 MB max RSS | 2.80 s, 607 MB |
| `npx vitest run` (median of 3) | 0.73 s, 116 MB | 2.90 s, 496 MB |
| `npm run test-types` (median of 3) | 1.08 s | 1.13 s (not touched by typesugar) |
| Tests | 117/117 vitest, type tests pass | identical |
| `index.es.js` raw / gzip / brotli | 18,302 / 4,118 / 3,564 | identical |
| `index.cjs.js` raw / gzip / brotli | 18,567 / 4,172 / 3,611 | identical |
| `index.d.ts` raw / gzip / brotli | 21,764 / 4,345 / 3,732 | identical |

- The build and test overhead is fixed cost with nothing to expand: each
  plugin instance builds a TypeScript 5.9 Program at start (F3).
- Bench, v8.2.0 against Stage 0, 5 rounds (`bench-v8.2.0-vs-stage-0/`):
  14 of 14 deltas are smaller than their spread, as they must be for
  identical bytes. The median delta was +5.2% (range −5.1% to +8.1%), and the
  two reference tasks, which never touch neverthrow, moved +1.1% and +4.4%.
  So on this machine at this load a run can't resolve differences under
  about 10% (F4). The write-up benches need a quiet machine and an A/A
  calibration run first.

## Findings

_typesugar bugs, gaps and design lessons, and method notes, each with its
evidence. IDs are never reused; a finding that is overturned is marked
superseded, not deleted._

- **F1 (compatibility, open): typesugar requires TypeScript 5.9+, neverthrow
  pins 4.7.2.** Every typesugar package has the peer range `>=5.9.0 <7.0.0`.
  neverthrow builds, type-checks and runs its type tests with TypeScript
  4.7.2. Stage 0 works because the typesugar tarballs and TypeScript 5.9.3 are
  installed in a separate `case-study/` npm project, so typesugar's pipeline
  type-checks neverthrow's source with 5.9 while rpt2 and `tsc` keep 4.7.
  From Stage 1 on that split matters: macro expansion sees 5.9 semantics, and
  the `.d.ts` build and type tests see unexpanded source under 4.7 (as Turf
  F5). A library that can't upgrade TypeScript has to accept this split or
  can't adopt typesugar. Evidence: `case-study/package.json`, the peer ranges
  in each package's `package.json`.
- **F2 (case-study tooling, fixed here): `pack.sh` wrote the git remote URL,
  credentials included, into the committed `vendor/typesugar/COMMIT`.** The
  typesugar checkout's `origin` is an HTTPS URL with an access token in it,
  and `pack.sh` only rewrote `git@` URLs. Caught in the local commit before
  anything was pushed; the commit was amended and the old objects pruned.
  `pack.sh` now strips `user:token@` from the URL. Turf's `pack.sh` has the
  same latent bug (its committed `COMMIT` files are clean, because that
  checkout's remote had no credentials) and should get the same one-line
  fix.
- **F3 (cost, open): the build plugins cost ~1.3–2.2 s and ~280–380 MB even
  when nothing imports typesugar.** Median of 3 on a busy machine: `npm run
  build` 1.47 s → 2.80 s (328 → 607 MB max RSS), `vitest run` 0.73 s →
  2.90 s (116 → 496 MB). Every plugin instance creates a full TypeScript
  Program in `buildStart`, before it knows whether any module uses a macro;
  neverthrow's Rollup config has two JS builds, so two Programs. For a
  1.2k-line library this fixed cost is most of the build. A cheap pre-scan
  (does any module import a typesugar package or carry a typesugar JSDoc
  tag?) could skip the Program when the answer is no. Not filed yet.
  Evidence: `case-study/results/stage-0/timings.json`.
- **F4 (method): at load 13–18 this machine can't resolve runtime deltas
  under about 10%.** With byte-identical code on both sides, 5 interleaved
  rounds gave a median delta of +5.2% (range −5.1% to +8.1%) and spreads up
  to 20%. Final numbers need a quiet machine, and an A/A run (the same tree
  as both sides) to calibrate the noise floor before any A/B is read.
  Evidence: `case-study/results/stage-0/bench-v8.2.0-vs-stage-0/`.
- **F5 (baseline for Stage 3): a `safeTry` block costs about 26 times the
  equivalent `andThen` chain.** Same inputs, two fallible steps and a map:
  `safeTry` with two `yield*`s ran 2,268 batches of 1,000 per second (about
  440 ns per chain), the `andThen` / `map` / `mapErr` chain 59,569 (about
  17 ns). The generator object and its iterator protocol are the cost; V8
  removes most of the class allocations in the `andThen` chain. One machine,
  busy (F4), but a 26× gap is far outside the noise. Evidence: v8.2.0 column
  of `bench-v8.2.0-vs-stage-0/summary.md`.
- **F6 (gap, minor): the plugin's `verbose` mode doesn't show modules it
  passed through.** It logs the config, the Program size and each module it
  changed, so with nothing to expand it prints the same as a plugin that
  never ran. Proving Stage 0 needed the wrapper experiments above (Turf could
  use the loader's `TYPESUGAR_VERBOSE` pass-through lines). A "passed through"
  line per module in verbose mode would do. Not filed yet.
