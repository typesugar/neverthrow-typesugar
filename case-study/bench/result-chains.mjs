#!/usr/bin/env node
// Result-chain microbenchmarks for the case study (neverthrow ships none).
//
//   node case-study/bench/result-chains.mjs [--dist <dir>] [--filter <substring>]
//
// Loads neverthrow from a BUILT tree (default ./dist; the bench runner passes
// each side's dist), so A and B run this same file and differ only in the
// library code. It loads `index.cjs.js`, which is what Node resolves for both
// `require("neverthrow")` and `import` (package.json has `main` and no
// `exports`). No TypeScript and no typesugar loader is involved, so the
// loader cannot skew the numbers (Turf finding F7).
//
// Each task runs one batch over 1,000 fixed inputs, so per-call timer
// overhead is amortised; ops/sec is batches per second. Inputs are generated
// from a fixed seed (Turf finding F6: random fixtures add input noise).
//
// The "reference:" tasks are a hand-written tagged-union version of the same
// pipeline. They don't touch neverthrow, so they are identical on both sides
// of an A/B run and serve as a noise control (their delta should be ~0), and
// they show what a person would write without the classes.
//
// Output lines use benchmark.js's format, which case-study/bench-ab.mjs
// parses:  <name> x <ops/sec> ops/sec ±<rme>% (<samples> runs sampled)

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Bench } from "tinybench";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(opt("--dist", path.join(here, "../../dist")));
const filter = opt("--filter", "");
const time = Number(opt("--time", "500"));

const require = createRequire(import.meta.url);
const nt = require(path.join(dist, "index.cjs.js"));
const { ok, err, Result, safeTry, okAsync, errAsync, fromThrowable } = nt;

// ---------------------------------------------------------------------------
// Fixed inputs: 1,000 strings, ~10% of them not numbers, ~10% out of range.

const N = 1000;
let seed = 0x2545f491;
const rand = () => {
  // xorshift32
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 2 ** 32;
};
const inputs = Array.from({ length: N }, () => {
  const r = rand();
  if (r < 0.1) return "x" + Math.floor(rand() * 100);
  if (r < 0.2) return String(1000 + Math.floor(rand() * 1000));
  return String(Math.floor(rand() * 1000));
});
const numbers = inputs.map((s, i) => i);
const okResults = numbers.map((n) => ok(n));
const mixedResults = inputs.map((s, i) => (i % 10 === 3 ? err("bad " + s) : ok(i)));

// The steps of a typical parse/validate/convert pipeline.
const parse = (s) => {
  const n = Number(s);
  return Number.isNaN(n) ? err({ kind: "parse", input: s }) : ok(n);
};
const validate = (n) => (n < 1000 ? ok(n) : err({ kind: "range", value: n }));
const toUser = (n) => ({ id: n, name: "user" + n });
const toHttp = (e) => (e.kind === "parse" ? 400 : 422);
const inc = (n) => n + 1;
const dbl = (n) => n * 2;
const sq = (n) => n * n;
const throwsSometimes = (s) => {
  if (s.charCodeAt(0) === 120 /* "x" */) throw new Error("not a number: " + s);
  return s.length;
};
const safeLength = fromThrowable(throwsSometimes, (e) => e.message);

// Hand-written reference: the same pipeline as plain tagged objects.
const rOk = (value) => ({ ok: true, value });
const rErr = (error) => ({ ok: false, error });
const rParse = (s) => {
  const n = Number(s);
  return Number.isNaN(n) ? rErr({ kind: "parse", input: s }) : rOk(n);
};
const rValidate = (n) => (n < 1000 ? rOk(n) : rErr({ kind: "range", value: n }));

// Results are folded into a sink so V8 can't drop the work.
let sink = 0;
const use = (x) => {
  sink = (sink + (typeof x === "number" ? x : x ? 1 : 0)) | 0;
};

// ---------------------------------------------------------------------------

const bench = new Bench({ time, warmupTime: 200, warmupIterations: 20 });

const add = (name, fn) => {
  if (!filter || name.includes(filter)) bench.add(name, fn);
};

add("map x3 on Ok", () => {
  for (let i = 0; i < N; i++) use(ok(i).map(inc).map(dbl).map(sq).value);
});

add("map x3 on Err (skipped)", () => {
  for (let i = 0; i < N; i++) use(err(i).map(inc).map(dbl).map(sq).isErr());
});

add("andThen pipeline: parse, validate, map, mapErr (80% Ok)", () => {
  for (let i = 0; i < N; i++) {
    const r = parse(inputs[i]).andThen(validate).map(toUser).mapErr(toHttp);
    use(r.isOk());
  }
});

add("andThen pipeline + match", () => {
  for (let i = 0; i < N; i++) {
    use(
      parse(inputs[i])
        .andThen(validate)
        .map(toUser)
        .match(
          (u) => u.id,
          (e) => (e.kind === "parse" ? -1 : -2)
        )
    );
  }
});

add("isOk() narrowing over existing Results", () => {
  let s = 0;
  for (let i = 0; i < N; i++) {
    const r = mixedResults[i];
    if (r.isOk()) s += r.value;
  }
  use(s);
});

add("unwrapOr over existing Results", () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += mixedResults[i].unwrapOr(0);
  use(s);
});

add("Result.combine (1,000 Ok)", () => {
  use(Result.combine(okResults).isOk());
});

add("Result.combineWithAllErrors (1,000, 10% Err)", () => {
  use(Result.combineWithAllErrors(mixedResults).isErr());
});

add("safeTry: 2 yields, 80% Ok", () => {
  for (let i = 0; i < N; i++) {
    const r = safeTry(function* () {
      const n = yield* parse(inputs[i]);
      const v = yield* validate(n);
      return ok(toUser(v));
    });
    use(r.isOk());
  }
});

add("fromThrowable wrapper (10% throw)", () => {
  for (let i = 0; i < N; i++) use(safeLength(inputs[i]).isOk());
});

add("reference: hand-written tagged union pipeline", () => {
  for (let i = 0; i < N; i++) {
    let r = rParse(inputs[i]);
    if (r.ok) r = rValidate(r.value);
    if (r.ok) r = rOk(toUser(r.value));
    else r = rErr(toHttp(r.error));
    use(r.ok);
  }
});

add("reference: hand-written map x3", () => {
  for (let i = 0; i < N; i++) {
    let r = rOk(i);
    if (r.ok) r = rOk(inc(r.value));
    if (r.ok) r = rOk(dbl(r.value));
    if (r.ok) r = rOk(sq(r.value));
    use(r.value);
  }
});

// Async: 1,000 chains awaited one after another (microtask-bound).
add("ResultAsync: okAsync, map, andThen, map (awaited)", async () => {
  for (let i = 0; i < N; i++) {
    const r = await okAsync(i)
      .map(inc)
      .andThen((n) => (n % 10 === 0 ? errAsync("ten") : okAsync(n)))
      .map(dbl);
    use(r.isOk());
  }
});

add("Result.asyncAndThen + map (awaited)", async () => {
  for (let i = 0; i < N; i++) {
    const r = await parse(inputs[i])
      .asyncAndThen((n) => okAsync(n))
      .map(dbl);
    use(r.isOk());
  }
});

await bench.warmup?.();
await bench.run();

for (const t of bench.tasks) {
  const r = t.result;
  if (!r || r.error) {
    console.error(`${t.name}: failed: ${r?.error ?? "no result"}`);
    process.exitCode = 1;
    continue;
  }
  const hz = r.hz.toLocaleString("en-US", { maximumFractionDigits: 2 });
  console.log(`${t.name} x ${hz} ops/sec ±${r.rme.toFixed(2)}% (${r.samples.length} runs sampled)`);
}
if (sink === 0.5) console.log(""); // keep sink observable
