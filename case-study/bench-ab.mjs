#!/usr/bin/env node
// A/B benchmark runner for the case study (adapted from the Turf study's
// case-study/bench.mjs).
//
//   node case-study/bench-ab.mjs --a v8.2.0 --b stage-0 [--rounds 5] \
//     [--time 500] [--filter <substring>] [--out case-study/results/<name>]
//
// For each ref it makes a separate git worktree under --work (default
// $TMPDIR/neverthrow-case-study-bench), runs `npm ci` (and `npm ci` in
// case-study/ when the ref has it, for the vendored typesugar), and builds
// with neverthrow's own `npm run build`. Pass --a-dir / --b-dir instead of a
// ref to use a tree you have already installed and built.
//
// Then, one process at a time, it runs THIS checkout's
// case-study/bench/result-chains.mjs against each side's dist/, for N
// rounds. Each round runs both sides in a fresh process each, and the order
// alternates (A,B then B,A) so neither side always goes first (Turf finding
// F26). It writes summary.json and summary.md: median ops/sec per benchmark
// and side, the spread (min-max and IQR, as % of the median), and the delta
// of the B median against A. A delta smaller than the spread is flagged as
// noise. The "reference:" benchmarks don't use neverthrow at all, so their
// deltas show the run's noise floor.
//
// The bench loads the built CommonJS file, not TypeScript source, so no
// typesugar loader runs in the bench process on either side (Turf F7 does not
// apply).
//
// Numbers are only comparable within one run: same machine, same process
// ordering, interleaved. The output records the machine, Node version, date
// and the load average at start and end.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const benchFile = path.join(here, "bench", "result-chains.mjs");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(name);

if (flag("--help") || (!opt("--a") && !opt("--a-dir"))) {
  process.stdout.write(
    fs
      .readFileSync(fileURLToPath(import.meta.url), "utf8")
      .split("\n")
      .filter((l) => l.startsWith("//"))
      .map((l) => l.replace(/^\/\/ ?/, ""))
      .join("\n") + "\n"
  );
  process.exit(flag("--help") ? 0 : 1);
}

const rounds = Number(opt("--rounds", "5"));
const time = opt("--time", "500");
const filter = opt("--filter", "");
const work = path.resolve(opt("--work", path.join(os.tmpdir(), "neverthrow-case-study-bench")));
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.resolve(opt("--out", path.join(repo, "case-study", "results", `bench-${stamp}`)));

const sh = (cmd, argv, cwd) =>
  execFileSync(cmd, argv, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" }).trim();

function run(cmd, argv, cwd) {
  const r = spawnSync(cmd, argv, { cwd, stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(" ")} failed in ${cwd}`);
}

/** A tree to bench: an existing dir, or a worktree of `ref` that we install and build. */
function prepare(label, ref, dir) {
  if (dir) {
    dir = path.resolve(dir);
    return { label, ref: ref ?? null, dir, sha: sh("git", ["rev-parse", "HEAD"], dir) };
  }
  const sha = sh("git", ["rev-parse", `${ref}^{commit}`], repo);
  const tree = path.join(work, `${label}-${sha.slice(0, 12)}`);
  if (!fs.existsSync(tree)) {
    fs.mkdirSync(work, { recursive: true });
    sh("git", ["worktree", "add", "--detach", tree, sha], repo);
  }
  console.error(`[bench] ${label}: ${ref} (${sha.slice(0, 12)}) in ${tree}`);
  run("npm", ["ci", "--no-audit", "--no-fund"], tree);
  if (fs.existsSync(path.join(tree, "case-study", "package-lock.json"))) {
    run("npm", ["ci", "--no-audit", "--no-fund"], path.join(tree, "case-study"));
  }
  run("npm", ["run", "build"], tree);
  return { label, ref, dir: tree, sha };
}

const LINE = /^(.*?) x ([\d,]+(?:\.\d+)?) ops\/sec ±([\d.]+)% \((\d+) runs? sampled\)/;

/** Run the bench once against one tree's dist; returns { name: { hz, rme } }. */
function benchOnce(tree) {
  const argv = [benchFile, "--dist", path.join(tree.dir, "dist"), "--time", time];
  if (filter) argv.push("--filter", filter);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, argv, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`bench failed in ${tree.label}\n${r.stdout}\n${r.stderr}`);
  const results = {};
  for (const line of r.stdout.split("\n")) {
    const m = LINE.exec(line.trim());
    if (m) results[m[1].trim()] = { hz: Number(m[2].replace(/,/g, "")), rme: Number(m[3]) };
  }
  return { results, seconds: (Date.now() - t0) / 1000 };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

function stats(xs) {
  const med = median(xs);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  return {
    n: xs.length,
    median: med,
    min,
    max,
    q1,
    q3,
    rangePct: med ? ((max - min) / med) * 100 : 0,
    iqrPct: med ? ((q3 - q1) / med) * 100 : 0,
    samples: xs,
  };
}

const machine = () => ({
  cpu: os.cpus()[0]?.model ?? "unknown",
  cores: os.cpus().length,
  memoryGB: Math.round(os.totalmem() / 2 ** 30),
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  node: process.version,
});

// ---------------------------------------------------------------------------

const loadStart = os.loadavg();
const started = new Date().toISOString();
const A = prepare("A", opt("--a"), opt("--a-dir"));
const B = prepare("B", opt("--b"), opt("--b-dir"));

const raw = {}; // bench name -> { A: [], B: [] }
const durations = { A: [], B: [] };
for (let round = 1; round <= rounds; round++) {
  const order = round % 2 ? [A, B] : [B, A];
  for (const tree of order) {
    console.error(`[bench] round ${round}/${rounds} ${tree.label}`);
    const { results, seconds } = benchOnce(tree);
    durations[tree.label].push(seconds);
    for (const [name, { hz }] of Object.entries(results)) {
      raw[name] ??= { A: [], B: [] };
      raw[name][tree.label].push(hz);
    }
  }
}
const loadEnd = os.loadavg();

const summary = [];
for (const [name, sides] of Object.entries(raw)) {
  if (!sides.A.length || !sides.B.length) continue;
  const a = stats(sides.A);
  const b = stats(sides.B);
  const deltaPct = ((b.median - a.median) / a.median) * 100;
  const spreadPct = Math.max(a.rangePct, b.rangePct);
  summary.push({
    benchmark: name,
    A: a,
    B: b,
    deltaPct,
    spreadPct,
    // One round has no spread, so it cannot tell signal from noise.
    noise: rounds < 2 ? null : spreadPct > Math.abs(deltaPct),
  });
}

const report = {
  started,
  finished: new Date().toISOString(),
  machine: machine(),
  loadAverage: { start: loadStart, end: loadEnd },
  rounds,
  timePerTaskMs: Number(time),
  order: "fresh process per side per round; A,B on odd rounds, B,A on even rounds",
  A: { ref: A.ref, sha: A.sha, dir: A.dir },
  B: { ref: B.ref, sha: B.sha, dir: B.dir },
  durationsSeconds: durations,
  results: summary,
};

const f0 = (x) => Math.round(x).toLocaleString("en-US");
const f1 = (x) => x.toFixed(1);
const la = (l) => l.map((x) => x.toFixed(2)).join(" ");
const md = [
  `# Bench A/B: ${A.ref ?? A.dir} vs ${B.ref ?? B.dir}`,
  "",
  `- A: \`${A.sha.slice(0, 12)}\`; B: \`${B.sha.slice(0, 12)}\``,
  `- Machine: ${report.machine.cpu}, ${report.machine.cores} cores, ${report.machine.memoryGB} GB, ${report.machine.platform}; Node ${report.machine.node}`,
  `- Date: ${started} to ${report.finished}`,
  `- Load average (1/5/15 min): start ${la(loadStart)}, end ${la(loadEnd)}`,
  `- ${rounds} rounds, ${time} ms per task, fresh process per side, order alternating. Spread is the larger side's (max-min)/median. Ops/sec are batches of 1,000 inputs per second.`,
  "",
  "| Benchmark | A median ops/s | B median ops/s | Δ % | Spread % (A / B) | IQR % (A / B) | |",
  "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ...summary.map(
    (r) =>
      `| ${r.benchmark.replace(/\|/g, "\\|")} | ${f0(r.A.median)} | ${f0(r.B.median)} | ${r.deltaPct >= 0 ? "+" : ""}${f1(r.deltaPct)} | ${f1(r.A.rangePct)} / ${f1(r.B.rangePct)} | ${f1(r.A.iqrPct)} / ${f1(r.B.iqrPct)} | ${r.noise ? "noise: spread > Δ" : ""} |`
  ),
  "",
  rounds < 2
    ? "One round: no spread, so no delta here can be told apart from noise."
    : `${summary.filter((r) => r.noise).length} of ${summary.length} deltas are smaller than their spread.`,
  "",
].join("\n");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "summary.md"), md);
process.stdout.write(md);
console.error(`[bench] wrote ${outDir}/summary.{json,md}`);
