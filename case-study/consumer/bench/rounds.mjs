#!/usr/bin/env node
// Runs run.mjs for N rounds in fresh processes, alternating plain and
// --pollute order, and prints the median ops/sec and spread (max-min over
// median) of each case in each mode.
//
//   node rounds.mjs [--rounds 5] [--time 500] [--out file.json]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const rounds = Number(opt("--rounds", "5"));
const time = opt("--time", "500");
const LINE = /^(.*?) x ([\d,]+(?:\.\d+)?) ops\/sec/;
const modes = { clean: [], polluted: ["--pollute"] };
const raw = { clean: {}, polluted: {} };
const loadStart = os.loadavg();
for (let i = 0; i < rounds; i++) {
  for (const mode of i % 2 ? ["polluted", "clean"] : ["clean", "polluted"]) {
    const r = spawnSync(process.execPath, [path.join(here, "run.mjs"), "--time", time, ...modes[mode]], {
      encoding: "utf8",
    });
    if (r.status !== 0) throw new Error(r.stderr);
    for (const line of r.stdout.split("\n")) {
      const m = LINE.exec(line.trim());
      if (m) (raw[mode][m[1]] ??= []).push(Number(m[2].replace(/,/g, "")));
    }
    console.error(`round ${i + 1}/${rounds} ${mode}`);
  }
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const summary = {};
for (const mode of Object.keys(raw)) {
  summary[mode] = {};
  for (const [name, xs] of Object.entries(raw[mode])) {
    const med = median(xs);
    summary[mode][name] = { median: med, spreadPct: ((Math.max(...xs) - Math.min(...xs)) / med) * 100, samples: xs };
  }
}
const report = {
  date: new Date().toISOString(),
  machine: `${os.cpus()[0]?.model}, ${os.cpus().length} cores, node ${process.version}`,
  loadAverage: { start: loadStart, end: os.loadavg() },
  rounds,
  timePerTaskMs: Number(time),
  summary,
};
const rows = Object.keys(summary.clean).map((n) => {
  const a = summary.clean[n];
  const b = summary.polluted[n];
  const f = (x) => Math.round(x).toLocaleString("en-US");
  return `| ${n} | ${f(a.median)} | ${a.spreadPct.toFixed(0)}% | ${f(b.median)} | ${b.spreadPct.toFixed(0)}% |`;
});
const md = [
  `Consumer bench, ${rounds} rounds, ${time} ms per task; ${report.machine}; load ${loadStart.map((x) => x.toFixed(1)).join("/")} → ${report.loadAverage.end.map((x) => x.toFixed(1)).join("/")}. Batches of 1,000 per second.`,
  "",
  "| Case | Clean median | Spread | Polluted median | Spread |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...rows,
  "",
].join("\n");
process.stdout.write(md);
if (opt("--out")) {
  fs.writeFileSync(opt("--out"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(opt("--out").replace(/\.json$/, ".md"), md);
}
