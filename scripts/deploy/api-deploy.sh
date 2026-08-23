#!/usr/bin/env bash
#
# Deploy the API to one of the two hand-provisioned boxes.
#
# No workflow deployed these hosts until this script existed, which is why the
# dev box was found 254 commits and six migrations behind on 2026-08-23 while
# main had been green for days. "Merged" said nothing about what was running.
#
# Every step below exists because skipping it has actually broken something:
#
#   PATH first        pm2 restart --update-env replaces the process environment
#                     with the CALLING shell's. Over SSH that resolves `node` to
#                     the system v18, and the app dies at boot on an ESM require
#                     that looks like a dependency bug. Export the nvm bin first.
#
#   heap + swap       tsc is OOM-killed on the 1.9 GB dev box. Swap alone is not
#                     enough - @yosemite-crew/auth still aborts with exit 134,
#                     "Ineffective mark-compacts near heap limit" - so the V8 old
#                     space is raised explicitly too.
#
#   clean tsbuildinfo A stale tsconfig.tsbuildinfo makes tsc report success and
#                     rebuild NOTHING. That shipped a backend bundled against a
#                     types/dist that predated a changed form.ts. Exit code 0 is
#                     not evidence; the freshness count below is.
#
#   per-package build The root build fans out to Next and Electron and OOMs.
#
#   smoke on a spare  pm2 says "online" for a process that is crash-looping, and
#   port BEFORE pm2   an immediate port check races the boot. Boot the new bundle
#                     somewhere harmless first; only cut over if it answers.
#
# Usage: api-deploy.sh <repo-dir> <pm2-target> <git-ref> [smoke-port]
set -euo pipefail

REPO_DIR="${1:?repo dir required}"
PM2_TARGET="${2:?pm2 process name or id required}"
GIT_REF="${3:?git ref required}"
SMOKE_PORT="${4:-8099}"

NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.21.1/bin}"
export PATH="$NODE_BIN:$PATH"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

say() { printf '\n=== %s ===\n' "$1"; }

cd "$REPO_DIR"

say "preflight"
node -v
ROLLBACK_SHA="$(git rev-parse HEAD)"
echo "rollback sha: $ROLLBACK_SHA"
STAMP="$(date +%Y%m%d-%H%M%S)"
echo "$ROLLBACK_SHA" > "/tmp/api-rollback-$STAMP.txt"
tar czf "/tmp/api-dist-before-$STAMP.tgz" apps/backend/dist packages/*/dist 2>/dev/null || true
cp apps/backend/.env "/tmp/api-env-before-$STAMP" 2>/dev/null || true
echo "backups: /tmp/api-dist-before-$STAMP.tgz  /tmp/api-env-before-$STAMP"

say "checkout $GIT_REF"
# --prune is load-bearing. A remote branch named `fix` had been deleted upstream
# while the box still held refs/remotes/origin/fix, so every refs/remotes/origin/fix/*
# the fetch tried to create failed to lock, the whole fetch failed, and the deploy
# stopped at "couldn't find remote ref". Pruning clears the deleted parent ref first.
#
# The ref is accepted as either `dev` or `origin/dev`; `git rev-parse` below adds the
# remote itself, and passing the qualified form asked the remote for a branch called
# `origin/dev`, which does not exist.
GIT_REF="${GIT_REF#origin/}"
git fetch --quiet --prune origin "$GIT_REF" || git fetch --quiet --prune origin
git checkout --detach "$(git rev-parse "origin/$GIT_REF" 2>/dev/null || echo "$GIT_REF")" --quiet
git rev-parse --short HEAD

say "install"
pnpm install --frozen-lockfile

say "prisma client + migrations"
pnpm --filter @yosemite-crew/database run prisma:generate
pnpm --filter @yosemite-crew/database run prisma:deploy

say "build packages"
BUILD_START="$(date '+%Y-%m-%d %H:%M:%S')"
sleep 1
for pkg in types fhirtypes fhir lib database auth; do
  # Remove the incremental state, or a stale tsbuildinfo silently skips the build.
  rm -rf "packages/$pkg/dist" \
         "packages/$pkg/tsconfig.build.tsbuildinfo" \
         "packages/$pkg/tsconfig.tsbuildinfo" 2>/dev/null || true
  printf '  %-12s ' "$pkg"
  pnpm --filter "@yosemite-crew/$pkg" run build >"/tmp/build-$pkg.log" 2>&1 \
    && echo ok || { echo FAILED; tail -20 "/tmp/build-$pkg.log"; exit 1; }
done
printf '  %-12s ' backend
pnpm --filter backend run build >/tmp/build-backend.log 2>&1 \
  && echo ok || { echo FAILED; tail -30 /tmp/build-backend.log; exit 1; }

say "freshness (exit 0 is not evidence a build produced anything)"
for pkg in types fhirtypes fhir lib database auth; do
  fresh="$(find "packages/$pkg/dist" -type f -newermt "$BUILD_START" 2>/dev/null | wc -l | tr -d ' ')"
  total="$(find "packages/$pkg/dist" -type f 2>/dev/null | wc -l | tr -d ' ')"
  printf '  %-12s %s/%s rebuilt\n' "$pkg" "$fresh" "$total"
  if [ "$fresh" = "0" ] && [ "$total" != "0" ]; then
    echo "  ERROR: $pkg produced no new files - stale incremental state" >&2
    exit 1
  fi
done
test -s apps/backend/dist/index.js || { echo "backend bundle missing" >&2; exit 1; }

say "smoke boot on :$SMOKE_PORT"
cd apps/backend
rm -f /tmp/api-smoke.log
PORT="$SMOKE_PORT" nohup node dist/index.js >/tmp/api-smoke.log 2>&1 &
SMOKE_PID=$!
trap 'kill "$SMOKE_PID" 2>/dev/null || true' EXIT
sleep 25
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$SMOKE_PORT/health" || echo 000)"
echo "  /health -> $CODE"
# An app-level JSON body proves Express reached a real handler; Express's own
# HTML 404 on a bogus path proves the probe was not just hitting a catch-all.
echo "  real route : $(curl -s --max-time 10 "http://127.0.0.1:$SMOKE_PORT/v1/pet-passport/mobile/companion/probe" | head -c 60)"
echo "  bogus route: $(curl -s --max-time 10 "http://127.0.0.1:$SMOKE_PORT/v1/definitely-not-a-route" | head -c 30)"
grep -iE 'ERR_REQUIRE_ESM|Cannot find module|FATAL ERROR' /tmp/api-smoke.log | head -5 || true
kill "$SMOKE_PID" 2>/dev/null || true
trap - EXIT
sleep 2
if [ "$CODE" != "200" ]; then
  echo "smoke boot failed - NOT cutting over. Rollback sha: $ROLLBACK_SHA" >&2
  exit 1
fi

say "cutover"
pm2 restart "$PM2_TARGET" --update-env
pm2 save
# pm2 reporting "online" is not the same as serving, and checking the port
# immediately races the boot. Give it time, then check what is actually true.
sleep 30
pm2 describe "$PM2_TARGET" | grep -iE 'status|node.js version' || true
ss -ltn 2>/dev/null | grep -q ':8080' \
  && echo "  listening on 8080" \
  || { echo "  NOTHING LISTENING on 8080 - roll back to $ROLLBACK_SHA" >&2; exit 1; }

say "done"
echo "deployed $(git -C "$REPO_DIR" rev-parse --short HEAD)  (rollback: $ROLLBACK_SHA)"
