#!/usr/bin/env bash
# Regenerate vendor/typesugar/*.tgz from a typesugar checkout.
#
#   vendor/typesugar/pack.sh /path/to/typesugar [ref]
#
# Checks out nothing itself: pass a clean checkout (or worktree) at the commit
# you want. Builds the packages the case study needs, packs them with `pnpm pack` (which
# rewrites workspace:* to real versions, as `npm publish` would), and records
# the commit in vendor/typesugar/COMMIT. Then run `npm --prefix case-study install` here.
set -euo pipefail

TS_REPO="${1:?usage: pack.sh /path/to/typesugar}"
OUT="$(cd "$(dirname "$0")" && pwd)"

# The packages the case study consumes, plus their workspace dependencies.
PACKAGES=(
  typesugar core macros transformer transformer-core lsp-common
  unplugin-typesugar reflect derive typeclass type-system std fp contracts validate
)

cd "$TS_REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "error: $TS_REPO has uncommitted changes; pack from a clean commit" >&2
  exit 1
fi
COMMIT="$(git rev-parse HEAD)"

pnpm install --frozen-lockfile
filters=()
for p in "${PACKAGES[@]}"; do filters+=(--filter "./packages/$p..."); done
# Two builds at a time by default: one transformer dts build peaks around
# 1.8 GB RSS. PACK_CONCURRENCY=1 keeps the whole build under ~2 GB.
pnpm -r --workspace-concurrency="${PACK_CONCURRENCY:-2}" "${filters[@]}" build

# Tarball names carry the commit (typesugar-core-0.1.1-<sha>.tgz): pnpm keys
# a file: dependency's store entry on the lockfile's integrity hash, so a
# repack under the same name would silently keep installing the old bytes.
SHORT="${COMMIT:0:8}"
rm -f "$OUT"/*.tgz
for p in "${PACKAGES[@]}"; do
  tgz="$(cd "packages/$p" && pnpm pack --pack-destination "$OUT" | tail -1)"
  mv "$tgz" "${tgz%.tgz}-$SHORT.tgz"
done

{
  echo "commit: $COMMIT"
  echo "branch: $(git rev-parse --abbrev-ref HEAD)"
  # Strip any credentials in the remote URL (https://user:token@host/...):
  # this file is committed.
  echo "remote: $(git remote get-url origin | sed -E 's#^git@[^:]+:#https://github.com/#; s#^(https?://)[^@/]+@#\1#; s#\.git$##')"
  echo "packed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "node:   $(node --version)"
  echo "files:"
  (cd "$OUT" && shasum -a 256 *.tgz | sed 's/^/  /')
} > "$OUT/COMMIT"

# Point the case-study package's dependencies and overrides at the new names.
REPO="$(cd "$OUT/../.." && pwd)"
sed -E -i.bak "s#(vendor/typesugar/[a-z-]+-[0-9]+\.[0-9]+\.[0-9]+[^-/\"]*)(-[0-9a-f]{8})?\.tgz#\1-$SHORT.tgz#g" \
  "$REPO/case-study/package.json"
rm -f "$REPO/case-study/package.json.bak"

echo "packed ${#PACKAGES[@]} packages from $COMMIT into $OUT"
echo "now run: npm --prefix case-study install"
