#!/usr/bin/env node
// Consumer-side benchmark: runs the cases in out/cases.js (compiled from
// cases.ts by `typesugar build`; see README.md) in ONE process.
//
//   node run.mjs [--pollute] [--time 500] [--filter <substring>]
//
// --pollute first calls Ok/Err's methods with many different callbacks
// (cases.ts `pollute()`), as a real program would, so the timed method
// calls run with the call-site feedback an app has, not a microbenchmark's.
// Prints benchmark.js-format lines (see ../../bench/result-chains.mjs).
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const require = createRequire(import.meta.url);
// tinybench is a devDependency of neverthrow itself (through vitest).
const { Bench } = require(require.resolve("tinybench", { paths: [path.resolve(here, "../../..")] }));
const c = require("./out/cases.js");
const { ok, err } = require("neverthrow");

if (args.includes("--pollute")) c.pollute();

const N = 1000;
let seed = 0x2545f491;
const rand = () => {
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
const results = inputs.map((s, i) =>
  i % 10 === 3 ? err({ kind: "parse", input: s }) : ok({ id: i, name: "u" + i })
);

let sink = 0;
const use = (x) => {
  sink = (sink + (typeof x === "number" ? x : x ? 1 : 0)) | 0;
};
const isOk = (r) => r.isOk();

const bench = new Bench({ time: Number(opt("--time", "500")), warmupTime: 200, warmupIterations: 20 });
const filter = opt("--filter", "");
const add = (name, fn) => {
  if (!filter || name.includes(filter)) bench.add(name, fn);
};

add("S2 chain: methods", () => { for (let i = 0; i < N; i++) use(isOk(c.chainMethods(inputs[i]))); });
add("S2 chain: hand-compiled", () => { for (let i = 0; i < N; i++) use(isOk(c.chainHand(inputs[i]))); });
add("S2 map x3: methods", () => { for (let i = 0; i < N; i++) use(c.map3Methods(i)); });
add("S2 map x3: hand-compiled", () => { for (let i = 0; i < N; i++) use(c.map3Hand(i)); });
add("S4 safeTry", () => { for (let i = 0; i < N; i++) use(isOk(c.viaSafeTry(inputs[i]))); });
add("S4 let: (typesugar)", () => { for (let i = 0; i < N; i++) use(isOk(c.viaDo(inputs[i]))); });
add("S6 async safeTry (awaited)", async () => { for (let i = 0; i < N; i++) use(isOk(await c.viaSafeTryAsync(inputs[i]))); });
add("S6 async let: (typesugar, awaited)", async () => { for (let i = 0; i < N; i++) use(isOk(await c.viaDoAsync(inputs[i]))); });
add("S6 async andThen/map (awaited)", async () => { for (let i = 0; i < N; i++) use(isOk(await c.viaMethodsAsync(inputs[i]))); });
add("S3 .match() method", () => { for (let i = 0; i < N; i++) use(c.viaMatchMethod(results[i])); });
add("S3 match() (typesugar)", () => { for (let i = 0; i < N; i++) use(c.viaMatchMacro(results[i])); });

await bench.run();
for (const t of bench.tasks) {
  const r = t.result;
  if (!r || r.error) {
    console.error(`${t.name}: failed: ${r?.error ?? "no result"}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`${t.name} x ${r.hz.toLocaleString("en-US", { maximumFractionDigits: 2 })} ops/sec ±${r.rme.toFixed(2)}% (${r.samples.length} runs sampled)`);
}
if (sink === 0.5) console.log("");
