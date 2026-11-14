// What opting in to typesugar costs the consumer's test run: the SAME plain
// tests (tests/plain) under the plain vitest config and under the typesugar
// one, interleaved (order alternating), median of N, with peak RSS from
// /usr/bin/time -l (macOS). Also times `typesugar check` on the whole project.
//
//   node timings.mjs [--runs 5] [--out file.json]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const runs = Number(opt("--runs", "5"));
const vitest = path.resolve(here, "../../node_modules/.bin/vitest");
const typesugar = path.resolve(here, "../node_modules/.bin/typesugar");

const tasks = {
  "vitest plain tests, plain config": [vitest, "run", "--config", "vitest.plain.config.mjs"],
  "vitest plain tests, typesugar config": [
    vitest, "run", "--config", "vitest.typesugar.config.mjs", "tests/plain",
  ],
  "typesugar check (whole project)": [typesugar, "check", "-p", "tsconfig.json"],
};

function timeOnce(argv) {
  const r = spawnSync("/usr/bin/time", ["-l", ...argv], { cwd: here, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${argv.join(" ")} failed\n${r.stdout}\n${r.stderr}`);
  const real = Number(/([\d.]+) real/.exec(r.stderr)[1]);
  const rss = Number(/(\d+)\s+maximum resident set size/.exec(r.stderr)[1]);
  return { seconds: real, rssMB: Math.round(rss / 2 ** 20) };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const loadStart = os.loadavg();
const samples = Object.fromEntries(Object.keys(tasks).map((k) => [k, []]));
const names = Object.keys(tasks);
for (let i = 0; i < runs; i++) {
  for (const name of i % 2 ? [...names].reverse() : names) samples[name].push(timeOnce(tasks[name]));
}
const result = {
  date: new Date().toISOString(),
  node: process.version,
  cpu: os.cpus()[0]?.model,
  loadAverage: { start: loadStart, end: os.loadavg() },
  runs,
  tasks: Object.fromEntries(
    names.map((n) => [
      n,
      {
        medianSeconds: median(samples[n].map((s) => s.seconds)),
        medianRssMB: median(samples[n].map((s) => s.rssMB)),
        samples: samples[n],
      },
    ])
  ),
};
for (const n of names) {
  const t = result.tasks[n];
  console.log(`${n}: ${t.medianSeconds.toFixed(2)} s, ${t.medianRssMB} MB`);
}
console.log(`load ${loadStart.map((x) => x.toFixed(1)).join("/")} → ${result.loadAverage.end.map((x) => x.toFixed(1)).join("/")}`);
if (opt("--out")) fs.writeFileSync(opt("--out"), JSON.stringify(result, null, 2) + "\n");
