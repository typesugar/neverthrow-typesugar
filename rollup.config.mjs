import typescript from "rollup-plugin-typescript2";
import dts from "rollup-plugin-dts";
import { createRequire } from "node:module";

// typesugar (case study). unplugin-typesugar is a dependency of the
// case-study package, not of the root, so resolve it from there. It runs
// before rollup-plugin-typescript2 (`enforce: "pre"`) and hands on a module
// only when expansion changed it; otherwise rpt2 compiles the file from disk
// exactly as before.
const caseStudyRequire = createRequire(new URL("./case-study/package.json", import.meta.url));
const typesugarRollup = caseStudyRequire("unplugin-typesugar/rollup");
const typesugar = typesugarRollup.default ?? typesugarRollup;

/**
 * Just a few details about this build implementation:
 * - Uses `rollup` along with `rollup-plugin-typescript2` to build to two target files 
 * (`index.es.js` and `index.cjs.js`). This means that there is only a *single* file now for each 
 * target rather than 4 files (ie. `index.js`, `chain.js`, etc.).
 * - Rollup has their own official @rollup/plugin-typescript plugin but it does not have the best 
 * TS declarations support atm (see https://github.com/rollup/plugins/issues/394, 
 * https://github.com/rollup/plugins/issues/254, https://github.com/rollup/plugins/issues/243).
 * Until these are resolved, I choose to just use `rollup-plugin-typescript2`.
 * - `rollup-plugin-typescript2` generates `index.d.ts`, `chain.d.ts`, `result.d.ts` and 
 * `result-async.d.ts` but this is inconsistent with the generated JavaScript files. This isn't a 
 * huge issues unless someone tries to import `neverthrow/dist/chain` which would error 
 * because the underlying `.js` doesn't exist. To remedy this issue, I used `rollup-plugin-dts` to 
 * merge `*.d.ts` files into a single `index.d.ts`.
 * - It's unfortunately a bit complicated to generate two build outputs but once some of the 
 * issues I've linked to above are resolved this process will become much easier :)
 * - Because the build process is kinda two steps (first using `rollup-plugin-typescript2` and then 
 * using `rollup-plugin-dts`), I first write to `tmp/`, then write the merged `index.d.ts` to 
 * `dist/` and then moved `index.es.js` and `index.cjs.js` to `dist/`.
 */

export default [
  {
    input: "src/index.ts",
    output: {
      file: "tmp/index.es.js",
      format: "es",
    },
    plugins: [typesugar({ tsconfig: "./tsconfig.json" }), typescript()],
  },
  {
    input: "src/index.ts",
    output: {
      file: "tmp/index.cjs.js",
      format: "cjs",
    },
    plugins: [typesugar({ tsconfig: "./tsconfig.json" }), typescript()],
  },
  {
    input: "tmp/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },
];
