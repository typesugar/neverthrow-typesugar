// Packs this repo's neverthrow (run `npm run build` at the root first) into
// .pack/neverthrow.tgz and reinstalls it, so the consumer sees exactly what
// npm would publish: package.json "files", dist/index.d.ts and all.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(here, ".pack");
fs.mkdirSync(out, { recursive: true });
// --ignore-scripts: prepack would rebuild; the caller has built already.
const name = execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", out], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .pop();
fs.renameSync(path.join(out, name), path.join(out, "neverthrow.tgz"));
// The tarball's name never changes, and the lockfile pins its hash: without
// these, npm keeps installing the previous pack.
fs.rmSync(path.join(here, "node_modules", "neverthrow"), { recursive: true, force: true });
fs.rmSync(path.join(here, "package-lock.json"), { force: true });
execFileSync("npm", ["install", "--no-audit", "--no-fund", "--install-links"], { cwd: here, stdio: "inherit" });
console.log(`packed ${name} -> .pack/neverthrow.tgz and installed it`);
