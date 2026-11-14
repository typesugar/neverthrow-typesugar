# neverthrow × typesugar: a case study

This fork of [neverthrow](https://github.com/supermacro/neverthrow) (MIT,
v8.2.0) is the second proof point for [typesugar](https://typesugar.org),
after the [Turf study](https://github.com/typesugar/turf-typesugar). We
refactor a real, widely used TypeScript library in stages using typesugar's
macros, and measure whether "zero cost" holds. It is a one-off study, not a
maintained fork; all credit for neverthrow itself goes to its authors.

Branch: `typesugar-case-study`, from tag `v8.2.0` (1d4cc19). Each stage is a
branch (`stage-0`, ...) with a PR on this fork; nothing is sent to
neverthrow upstream.

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
5. Can one package serve both kinds of consumer: unchanged for plain
   TypeScript, and compiled to hand-written code for consumers who opt in to
   typesugar, with `Result` values passing freely between the two?
6. What did adopting it cost: lines changed, friction, bugs found in
   typesugar, features that didn't fit?

## Ground rules

- **neverthrow's public API and its tests are the spec.** `tests/*.test.ts`
  and the type tests (`tests/typecheck-tests.ts`, run by `npm run
  test-types`) are not changed to make a stage pass. New tests may be added.
  A stage that needs a test change says why, in the stage log.
- **One package, two ways to consume it, one runtime representation.**
  Consumers who don't use typesugar get neverthrow exactly as today: `Ok` and
  `Err` stay classes, the methods stay on the instances, `instanceof` works.
  Consumers who opt in to typesugar get the same package, whose `.d.ts` also
  declares typesugar instances for `Result`, so their calls on `Result`
  compile to the code they'd write by hand. (A `./macros` entry is added only
  if a stage needs a macro that runs at build time; Stage 1 found that
  instances don't, F10.)
  Both kinds of code see the same class instances, so a `Result` can cross
  between them (a library built with plain `tsc` hands one to an app built
  with typesugar, and back) without conversion.
- **The published types stay.** `dist/index.d.ts` changes only by additions
  the stage log names, and `attw --pack` (part of `npm run build`) still
  passes.
- **Every stage is measured against the stage before it and against v8.2.0.**
- **typesugar bugs found here are fixed in typesugar** (failing test first) on
  typesugar branch `neverthrow-case-study-fixes`
  ([typesugar#87](https://github.com/typesugar/typesugar/pull/87)), and
  logged below. The fork
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
1. **Instances and a consumer.** neverthrow declares typesugar instances
   for `Result`: `Destructure` for `Ok` and `Err` (so `match()` patterns
   work) and `FlatMap` (so do-notation works). A consumer project
   (`case-study/consumer/`) installs neverthrow from a packed tarball and
   runs the same tests twice: compiled plainly, and compiled with typesugar,
   plus tests of code written with `match()` and `let:`. This is the first
   PEP-062 test: does resolution pick neverthrow's instances for
   neverthrow's `Result` while fp's `Either` sits in the same file?
   **Done**, see the log. The plan was a `./macros` entry approved through
   PEP-055; instances turned out to need neither (F10).
2. **Method chains compiled to hand-written code.** In typesugar-compiled
   code, `parse(s).andThen(validate).map(toUser).mapErr(toHttp)` becomes the
   branches a person would write: no method dispatch, no closures, one
   `Result` allocated at the end instead of one per step. The `instanceof`
   check doesn't go away: a sum type needs one branch, and hand-written code
   has it too; it moves from inside each method to one test per chain. The
   zero-cost bar is the `reference:` bench tasks, with the classes as the
   representation.
3. **`match()` over `Result`** in consumer code:
   `match(r).case(Ok(v))....case(Err(e))...`. Extractors are `Destructure`
   instances resolved from scope and keyed by the constructor's symbol, not
   its name (PEP-008 Wave 11, on typesugar main; the name-based `Ok`/`Err`
   were removed). So neverthrow's `./macros` entry ships one instance per
   class, with a `@destructure` descriptor so the pattern compiles to the
   test and field read inline (`v instanceof Ok`, `v.value`). The descriptor
   grammar has no `instanceof` test today (`not-null`, `null`, `always`,
   `has <key>`, `<field> = <literal>`); `has value`/`has error` would work
   for neverthrow's classes, but an `instanceof` test is the one a person
   would write, so expect a typesugar change here. Check also that a file
   importing fp's `Result` alongside neverthrow's resolves each to its own
   instance.
4. **Do-notation in place of `safeTry`.** typesugar's do-notation over
   neverthrow's `Result` (through Stage 1's `Monad`), compiled to plain
   branches, against `safeTry` generators. Stage 0's benchmark puts a
   two-step `safeTry` at about 26 times the cost of the same chain written
   with `andThen` (F6), so this is the stage with the largest expected win.
5. **`ok`/`err`, `fromThrowable` and return-type specialisation.**
   typesugar's return-type specialisation and fp's `ok`/`err` macros pick the
   result algebra by type name today (PEP-062 row 10;
   `fp/src/zero-cost/macros.ts` matches any `Result.<method>(...)` call by the
   identifier's text, and neverthrow has `Result.combine` and
   `Result.fromThrowable`). Test that a consumer using both keeps neverthrow's
   semantics, then compile `fromThrowable` wrappers to inline `try`/`catch`.
6. **`ResultAsync`.** The same for async chains, and whether typesugar's
   generic extension receivers (PR #86's open decision) mistake neverthrow's
   `Result` for fp's.

Considered and rejected: a different runtime representation for
typesugar consumers (an `@opaque` or `@adt` tagged object, with `instanceof
Ok` rewritten to a tag test). It removes nothing the class version can't (the
branch remains, and Stage 0's bench shows V8 already makes the class chain as
fast as the hand-written tagged union in a microbenchmark), and it breaks
interop: a `Result` built by plain code is a class instance, and one built by
typesugar code would be a plain object without the methods. If Stage 2 shows
the classes cost more than the reference at call sites that see many types,
a side experiment can measure that representation without shipping it.

Measuring the opt-in: the bench gains consumer-side cases written in
TypeScript and compiled ahead of time two ways (plain, and with typesugar),
both run against the same `dist/`. Compiling ahead of time keeps the Node
loader out of the bench process (Turf F7).

Stages 1–6 may be reordered or cut based on what each one teaches; the log
records why.

## Stage log

### Stage 0: integration, no source changes

**Result: byte-identical.** With typesugar in the build, `dist/index.es.js`,
`dist/index.cjs.js` and `dist/index.d.ts` are byte-identical to v8.2.0
(SHA-256 in `case-study/results/stage-0/dist-sha256.txt`), both in this
checkout and in clean worktree builds of each side. All 117 vitest tests pass
through typesugar, and the type tests, `typecheck` and `lint` pass as before.

typesugar: branch `neverthrow-case-study-fixes` at `932d6e55`, which is
`origin/main` at
[`86bcf8c7`](https://github.com/typesugar/typesugar/commit/86bcf8c7) (PR #86
merged) plus the fix for F3. It is vendored as tarballs in
`vendor/typesugar/`. Output was byte-identical before the fix too; the fix
only makes the build faster.

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
plugin that never ran. Two experiments wrap the plugin's `transform` and
record each call (the plugin's `verbose: true` option shows the same, one
"Transformed ... (changed: false)" line per module):

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
| `npm run build` (median of 5) | 0.84 s, 327 MB max RSS | 1.53 s, 584 MB |
| `npx vitest run` (median of 5) | 0.54 s, 116 MB | 1.60 s, 468 MB |
| `npm run test-types` (median of 5) | 0.89 s | 0.90 s (not touched by typesugar) |
| Tests | 117/117 vitest, type tests pass | identical |
| `index.es.js` raw / gzip / brotli | 18,302 / 4,118 / 3,564 | identical |
| `index.cjs.js` raw / gzip / brotli | 18,567 / 4,172 / 3,611 | identical |
| `index.d.ts` raw / gzip / brotli | 21,764 / 4,345 / 3,732 | identical |

- The build and test overhead is a fixed cost with nothing to expand: about
  0.7–1.1 s and 260–350 MB, which goes on loading TypeScript 5.9 and
  typesugar and building one Program per plugin instance (F4; not profiled
  further). Before the F3 fix every
  module rebuilt the Program; the fix took 0.3–0.4 s off each build and
  test run (`timings-86bcf8c7-vs-932d6e55.json`).
- Single runs and medians move with the machine's load: the same v8.2.0
  build took a median 1.47 s in an earlier set of 3 runs. Only the
  interleaved A/B pairs in one file are comparable.
- Bench, v8.2.0 against Stage 0, 5 rounds (`bench-v8.2.0-vs-stage-0/`, run
  with typesugar `86bcf8c7`; `dist/` is the same bytes either way): 14 of 14
  deltas are smaller than their spread, as they must be for identical bytes.
  The median delta was +5.2% (range −5.1% to +8.1%), and the two reference
  tasks, which never touch neverthrow, moved +1.1% and +4.4%. So on this
  machine at this load a run can't resolve differences under about 10% (F5).
  The write-up benches need a quiet machine and an A/A calibration run first.

### Stage 1: instances and a consumer

**Result: typesugar's `match()` and do-notation work on neverthrow's
`Result`, with neverthrow's JavaScript unchanged.** `dist/index.es.js` and
`dist/index.cjs.js` are byte-identical to v8.2.0; `dist/index.d.ts` gains
three declarations (+983 bytes raw, +285 gzip). neverthrow's 117 tests, type
tests, `typecheck` and `lint` pass.

typesugar: branch `neverthrow-case-study-fixes-2` at `8f533b00`, which is
`origin/main` at `325b018f` (includes #87) plus the fixes for F7 and F8.

What changed in neverthrow:

- `src/typesugar.ts` (new, re-exported from `src/index.ts`): three
  declarations, with no JavaScript behind them:
  - `destructureOk`: `@impl Destructure<typeof Ok, …>`, `@destructure has value -> value`;
  - `destructureErr`: the same for `Err`, `has error -> error`;
  - `flatMapResult`: `@impl FlatMap<Result>`, `@do-methods bind=andThen map=map`.

  typesugar reads the JSDoc tags from `index.d.ts`. It compiles a pattern to
  the field test and read the descriptor gives, and a comprehension to calls
  of `andThen` and `map` on the values, so it never refers to the instance
  values (checked: the expanded consumer code doesn't name them).
- `vitest.config.mjs`: excludes `case-study/**`, so the consumer's tests
  don't run as neverthrow's.

The consumer (`case-study/consumer/`) installs neverthrow from an `npm pack`
tarball of this repo, so it sees exactly what would be published:

- `src/pipeline.ts`: plain neverthrow, with no typesugar syntax.
- `src/sugar.ts`: the same functions written with `let:`/`yield:` and
  `match()`, plus the F7 and F8 cases.
- `tests/plain/` runs under both `vitest.plain.config.mjs` (no typesugar)
  and `vitest.typesugar.config.mjs`.
- `tests/typesugar/` runs only under the typesugar config. It checks that
  the typesugar functions return the same `Ok`/`Err` instances as the plain
  ones, and that `match()` takes values built by plain code.

3 tests pass plain and 10 pass with typesugar. `typesugar check` reports
nothing.

What typesugar compiles the consumer's code to
(`case-study/results/stage-1/consumer-sugar.expanded.ts`):

```ts
// let: { n << parse(s); v << validate(n); } yield: toUser(v)
const r = parse(s).andThen(n => validate(n).map(v => toUser(v)));

// match(r).case(Ok(u)).then(`user ${u.id}`).case(Err(e)).then(`error ${e.kind}`)
(() => {
    const _r = r;
    if ("value" in _r) {
        const u = _r.value;
        return `user ${u.id}`;
    }
    const e = _r.error;
    return `error ${e.kind}`;
})();
```

- **The `Err` arm has no test.** The two `has` tests cover the union, so
  the last arm needs none.
- **Impossible arms are dropped.** On a value typed `Ok<…>` alone, the
  `Err` arm is removed entirely.
- **A function wrapper per match.** Each match is wrapped in an immediately
  called function (Stage 3 looks at whether that costs anything).
- **`Either` alongside.** A file that also uses typesugar's `Either` (`Left`/`Right`) gets
  `"right" in e` for those and `"value" in r` for neverthrow's: resolution
  goes by the constructor, never the name (question 4).

Cost to the consumer (`consumer-timings.json`; median of 5, interleaved,
load 8–11):

| Run | Time | Peak RSS |
| --- | ---: | ---: |
| The 3 plain tests, plain vitest config | 0.28 s | 100 MB |
| The same 3 tests, typesugar vitest config | 0.81 s | 328 MB |
| `typesugar check`, whole consumer project | 0.80 s | 403 MB |

That is F4's fixed cost again, now seen from the consumer side.

Adoption cost for a consumer:

- typesugar in their build (the Vite, Rollup or esbuild plugin);
- TypeScript 5.9 or later (F1);
- `import "@typesugar/std/syntax/do"` in each file that uses `let:`, which
  stays in the output (F9);
- `import { match } from "@typesugar/std"` in each file that uses `match()`,
  which is removed.

There's no approval step and nothing to configure for neverthrow (F10).

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
  fix. Since Stage 1, `pack.sh` also refuses to write `COMMIT` if anything
  that looks like a credential survives the rewrite.
- **F3 (bug, fixed): the bundler plugins rebuilt the TypeScript Program once
  per module.** unplugin-typesugar's `transform` invalidated every module the
  first time it saw it, even when the bundler handed it the code on disk,
  which is what the Program was built from. Each invalidation drops the
  Program, so the next module rebuilt it: 5 Programs per Rollup build for
  neverthrow's 5 modules (`verbose: true` prints one "Creating TypeScript
  program" line per module). Every unplugin build has this, including the
  esbuild plugin Turf used. Fix: on first sight, invalidate only when the
  code differs from disk (another plugin rewrote it). Commit
  [`932d6e55`](https://github.com/typesugar/typesugar/commit/932d6e55) on
  typesugar branch `neverthrow-case-study-fixes`
  ([typesugar#87](https://github.com/typesugar/typesugar/pull/87)), failing test first
  (`packages/unplugin-typesugar/src/__tests__/neverthrow-case-study.test.ts`),
  with a changeset. Interleaved, 5 runs each: `npm run build` 2.11 s →
  1.78 s, `vitest run` 2.05 s → 1.63 s. Evidence:
  `case-study/results/stage-0/timings-86bcf8c7-vs-932d6e55.json`.
- **F4 (cost, open): even with F3 fixed, the plugins add ~0.7–1.1 s and
  ~260–350 MB when nothing imports typesugar.** Median of 5, interleaved, busy
  machine: `npm run build` 0.84 s → 1.53 s (327 → 584 MB max RSS), `vitest
  run` 0.54 s → 1.60 s (116 → 468 MB). The pipeline builds its Program on the
  first module it transforms, before it knows whether any module uses a
  macro, and neverthrow's Rollup config has two JS builds, so two Programs.
  For a 1.2k-line library this fixed cost is most of the build. A cheap
  pre-scan (does this module import a typesugar package or carry a typesugar
  JSDoc tag?) could skip the Program for modules that can't expand. Not
  filed yet. Evidence: `case-study/results/stage-0/timings.json`.
- **F5 (method): at load 12–18 this machine can't resolve runtime deltas
  under about 10%.** With byte-identical code on both sides, 5 interleaved
  rounds gave a median delta of +5.2% (range −5.1% to +8.1%) and spreads up
  to 20%. Final numbers need a quiet machine, and an A/A run (the same tree
  as both sides) to calibrate the noise floor before any A/B is read.
  Evidence: `case-study/results/stage-0/bench-v8.2.0-vs-stage-0/`.
- **F6 (baseline for Stage 3): a `safeTry` block costs about 26 times the
  equivalent `andThen` chain.** Same inputs, two fallible steps and a map:
  `safeTry` with two `yield*`s ran 2,268 batches of 1,000 per second (about
  440 ns per chain), the `andThen` / `map` / `mapErr` chain 59,569 (about
  17 ns). Presumably the generator object and the iterator protocol are the
  cost; not profiled. One busy machine (F5), but a 26× gap is far outside
  the noise. Evidence: v8.2.0 column of
  `case-study/results/stage-0/bench-v8.2.0-vs-stage-0/summary.md`.

- **F7 (bug, fixed): do-notation found its instance by the bind's printed
  type name, so a first bind typed `Ok<…>`, `Err<…>` or an alias of `Result`
  had "No FlatMap instance".** neverthrow's `ok(1)` is typed `Ok<number,
  never>`, so the most natural first line of a comprehension failed with
  TS9225, and so did `type Parsed<T> = Result<T, E>`. The brand was the
  printed name (`Ok`, `Parsed`), compared with the name in `@impl
  FlatMap<Result>`: the PEP-062 "match by type, not by name" anti-pattern.
  Fix: when no instance carries the brand's name, an instance whose declared
  type is made of the same class or interface declarations (compared by
  symbol) serves it; name matches still come first, and a same-named
  unrelated type still fails. Commit `8f533b00` on typesugar branch
  `neverthrow-case-study-fixes-2`
  ([typesugar#102](https://github.com/typesugar/typesugar/pull/102)), failing test first
  (`packages/std/tests/do-instance-by-type.test.ts`). Evidence: the probes
  in this stage's log, `case-study/consumer/src/sugar.ts` (`doubleChecked`,
  `viaAlias`).
- **F8 (bug, fixed): `typesugar check` and the editor reported a class used
  as a pattern, `.case(Ok(v))`, as TS2348 "Value of type 'typeof Ok' is not
  callable".** As written, the pattern calls a class without `new`; the
  expansion never calls it. fp's extractors are functions, so nothing had hit
  this; the pattern-matching guide's own `MyClass(v)` type pattern would
  have. Fix: TS2348 is suppressed inside `.case()`/`.or()` patterns and
  `match: switch` case patterns, and still reported in arm results and
  everywhere else. Same commit as F7, failing tests first
  (`diagnostic-suppression-rules.test.ts`).
- **F9 (cost, open; a design question): the do-notation activation import
  stays in the output.** `import "@typesugar/std/syntax/do"` is still there
  after expansion and loads two small chunks of std's own instances (about
  2.5 KB, no further dependencies; `@typesugar/std` declares `sideEffects:
  true`). So a consumer that uses `let:` has `@typesugar/std` as a runtime
  dependency, and pays for instances it never calls. `match()`'s import, by
  contrast, is removed. Nothing documents which is intended. Removing the
  import after expansion would make do-notation free at runtime. Evidence:
  line 3 of `case-study/results/stage-1/consumer-sugar.expanded.ts`.
- **F10 (design lesson): a library that only ships instances needs no
  `./macros` entry and no approval, and its instances can be declarations
  with no JavaScript.** Instances are found through the consumer's imports
  and through the file that declares the pattern's constructor, so instances
  in neverthrow's own `index.d.ts` are found without the consumer doing
  anything. Instances in a separate `./macros` entry would need an import in
  every consumer file. PEP-055's manifest and approval apply only to macros
  that run at build time. Because typesugar inlines both kinds of instance
  used here, they can be `declare const`. The cost is that the types say three values
  exist that aren't there at runtime: a plain consumer that imports
  `flatMapResult` gets `undefined` from CJS and a link error from ESM. Real
  objects would cost a few bytes each and make the types honest; that is a
  call for neverthrow's maintainers.
- **F11 (gap, open): exhaustiveness doesn't see through nested extractor
  patterns over a union of classes.** `Ok(Ok(v))`, `Ok(Err(e))` and `Err(e)`
  cover `Result<Result<T, E>, E>`, but the check reports TS9226 "the
  scrutinee type is not enumerable" and asks for `.else()`. One level of
  `Ok`/`Err` is fine. Stage 3. Evidence: `nested` in
  `case-study/consumer/src/sugar.ts`.

## Follow-ups outside this fork

- Turf fork: F2's `pack.sh` fix is applied (Turf `stage-3`, `147fdfd6e`).
- typesugar: F3's fix is merged
  ([typesugar#87](https://github.com/typesugar/typesugar/pull/87)). F7 and
  F8 are on branch `neverthrow-case-study-fixes-2`
  ([typesugar#102](https://github.com/typesugar/typesugar/pull/102)). F1, F4, F9 and F11 are
  not filed.
