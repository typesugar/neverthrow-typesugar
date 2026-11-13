#!/usr/bin/env node
// Stage 0 check: which modules does typesugar's Rollup plugin see, and which
// does it change? Builds src/index.ts (ES format, in memory) with the same
// plugins as rollup.config.mjs, wrapping the typesugar plugin's transform to
// record each call. Then builds the positive control (stage-0-control.ts)
// through the same plugin, which must change.
//
//   node case-study/experiments/stage-0-plugin-trace.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import typescript from "rollup-plugin-typescript2";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
process.chdir(repo);
const csRequire = createRequire(path.join(repo, "case-study/package.json"));
const mod = csRequire("unplugin-typesugar/rollup");
const typesugarRollup = mod.default ?? mod;

function traced(options) {
  const plugin = typesugarRollup(options);
  const calls = [];
  const inner = plugin.transform;
  const fn = typeof inner === "function" ? inner : inner.handler;
  const wrapped = async function (code, id) {
    const included = plugin.transformInclude ? plugin.transformInclude(id) : true;
    if (!included) {
      calls.push({ id: path.relative(repo, id), included, changed: false });
      return null;
    }
    const out = await fn.call(this, code, id);
    calls.push({ id: path.relative(repo, id), included, changed: out != null, out });
    return out;
  };
  // unplugin's rollup transform may be an object hook with a filter; keep the shape.
  plugin.transform = typeof inner === "function" ? wrapped : { ...inner, handler: wrapped };
  return { plugin, calls };
}

async function build(input, tsconfig) {
  const { plugin, calls } = traced({ tsconfig });
  const plugins = [plugin];
  if (input.startsWith("src/")) plugins.push(typescript());
  const bundle = await rollup({ input, plugins, onwarn: () => {}, external: () => false });
  await bundle.generate({ format: "es" });
  await bundle.close();
  return calls;
}

const lib = await build("src/index.ts", "./tsconfig.json");
console.log("neverthrow src/index.ts (ES build):");
for (const c of lib) console.log(`  ${c.id}: ${c.included ? (c.changed ? "CHANGED" : "passed through") : "not included"}`);

let control;
try {
  control = await build("case-study/experiments/stage-0-control.ts", "./tsconfig.json");
} catch (e) {
  console.log(`control build failed: ${e.message.split("\n")[0]}`);
}
if (control) {
  console.log("positive control:");
  for (const c of control) {
    console.log(`  ${c.id}: ${c.included ? (c.changed ? "CHANGED" : "passed through") : "not included"}`);
    if (c.changed) console.log(c.out.code.split("\n").map((l) => "    | " + l).join("\n"));
  }
}
