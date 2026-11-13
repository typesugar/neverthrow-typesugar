# Vendored typesugar

The case study consumes typesugar as packed tarballs, the same files
`npm publish` would upload, so a stage can be reproduced without a local
typesugar checkout or `npm link`.

- Which commit: see [`COMMIT`](./COMMIT) (commit, branch, pack date, Node
  version and the SHA-256 of every tarball).
- Wiring: `case-study/package.json` is a separate npm project (its own
  `package-lock.json`, installed with `npm --prefix case-study ci`). It depends
  on every packed package as `file:../vendor/typesugar/*.tgz`, and its
  `overrides` point each `@typesugar/*` name at that same dependency, so the
  transitive `@typesugar/*` dependencies resolve to these files, never to the
  npm registry. It also pins `typescript` 5.9.3 for typesugar, whose peer range
  is `>=5.9.0 <7.0.0`; neverthrow itself builds and type-checks with its own
  TypeScript 4.7.2 from the root lockfile.
- Keeping the typesugar dependencies out of the root `package.json` leaves
  neverthrow's manifest and `package-lock.json` exactly as v8.2.0 ships them.
- `rollup.config.mjs` and `vitest.config.mjs` resolve `unplugin-typesugar`
  from `case-study/package.json` with `createRequire`.

## Regenerate

From a clean typesugar checkout (or worktree) at the commit you want:

```sh
vendor/typesugar/pack.sh /path/to/typesugar
npm --prefix case-study install
```

`pack.sh` runs `pnpm install --frozen-lockfile` in the typesugar checkout,
builds the packages listed in it (two at a time; one transformer `.d.ts` build
peaks around 2 GB RSS), runs `pnpm pack` for each into this directory, and
rewrites `COMMIT`. Tarball names carry the first 8 characters of the commit
(`typesugar-core-0.1.1-86bcf8c7.tgz`), and `pack.sh` rewrites the references
in `case-study/package.json` to match, so a repack is never mistaken for the
old bytes by a package manager's cache (Turf finding F4).

Packed set: `typesugar`, `unplugin-typesugar` and `@typesugar/{core, macros,
transformer, transformer-core, lsp-common, reflect, derive, typeclass,
type-system, std, fp, contracts, validate}`.
