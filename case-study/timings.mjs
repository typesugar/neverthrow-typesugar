#!/usr/bin/env node
// Build and test wall times for two prepared trees (e.g. the worktrees that
// bench-ab.mjs made), interleaved A/B, median of N runs, with peak RSS from
// /usr/bin/time -l (macOS).
//
//   node case-study/timings.mjs --a-dir <tree> --b-dir <tree> [--runs 3] [--out file.json]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const args = process.argv.slice(2);
const opt = (n, f) => (args.includes(n) ? args[args.indexOf(n) + 1] : f);
const trees = { A: opt("--a-dir"), B: opt("--b-dir") };
const runs = Number(opt("--runs", "3"));
const commands = {
  build: ["npm", "run", "build"],
  vitest: ["npx", "vitest", "run"],
  "test-types": ["npm", "run", "test-types"],
};

const out = {};
for (const [name, cmd] of Object.entries(commands)) {
  out[name] = { A: [], B: [] };
  for (let i = 0; i < runs; i++) {
    for (const side of i % 2 ? ["B", "A"] : ["A", "B"]) {
      const t0 = process.hrtime.bigint();
      const r = spawnSync("/usr/bin/time", ["-l", ...cmd], { cwd: trees[side], encoding: "utf8" });
      const s = Number(process.hrtime.bigint() - t0) / 1e9;
      if (r.status !== 0) throw new Error(`${name} failed in ${side}\n${r.stdout}\n${r.stderr}`);
      const rss = Number(/(\d+)\s+maximum resident set size/.exec(r.stderr)?.[1] ?? NaN);
      out[name][side].push({ seconds: s, maxRssMB: Math.round(rss / 2 ** 20) });
    }
  }
}
const med = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const report = { date: new Date().toISOString(), node: process.version, load: os.loadavg(), trees, runs, out };
for (const [name, sides] of Object.entries(out)) {
  const line = ["A", "B"].map(
    (s) => `${s} ${med(sides[s].map((x) => x.seconds)).toFixed(2)} s / ${med(sides[s].map((x) => x.maxRssMB))} MB`
  );
  console.log(`${name}: ${line.join(", ")}  (median of ${runs}; max RSS of the top process)`);
}
if (opt("--out")) fs.writeFileSync(opt("--out"), JSON.stringify(report, null, 2) + "\n");
