#!/usr/bin/env node
// Raw, gzip (level 9) and brotli (quality 11) sizes of the built JS files.
//
//   node case-study/size.mjs [--dist dist] [--out file.json]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const opt = (n, f) => (args.includes(n) ? args[args.indexOf(n) + 1] : f);
const dist = path.resolve(opt("--dist", "dist"));
const rows = {};
for (const f of ["index.es.js", "index.cjs.js", "index.d.ts"]) {
  const buf = fs.readFileSync(path.join(dist, f));
  rows[f] = {
    raw: buf.length,
    gzip: zlib.gzipSync(buf, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
}
for (const [f, r] of Object.entries(rows)) console.log(`${f}: ${r.raw} raw, ${r.gzip} gzip, ${r.brotli} brotli`);
if (opt("--out")) fs.writeFileSync(opt("--out"), JSON.stringify(rows, null, 2) + "\n");
