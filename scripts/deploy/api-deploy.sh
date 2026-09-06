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
#   migrate AFTER     Migrations used to run at step 4 of 8, before the build. The
#   the build         cutover is step 7, so the OLD process served traffic against
#                     the NEW schema for the whole build AND smoke window - and a
#                     failed build left it there for good, because a failure exits
#                     without cutting over and nothing rolls a migration back.
#                     The build needs the generated Prisma CLIENT, not the
#                     database, so only `prisma generate` has to precede it. The
#                     smoke boot genuinely does need the new schema, so that much
#                     of the window is irreducible - what is left is reported
#                     explicitly on every path that stops without cutting over.
#
# Usage: api-deploy.sh <repo-dir> <pm2-target> <git-ref> [smoke-port]
set -euo pipefail

REPO_DIR="${1:?repo dir required}"
PM2_TARGET="${2:?pm2 process name or id required}"
GIT_REF="${3:?git ref required}"
SMOKE_PORT="${4:-8099}"

NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.21.1/bin}"

# Which startup controls stop a cutover. A LIST of names, never the aggregate
# /health/controls status - see lib/controls.sh for why the aggregate is the
# wrong gate. Overridable so an environment that genuinely runs without one of
# these does not need a code change to deploy.
DEPLOY_BLOCKING_CONTROLS="${DEPLOY_BLOCKING_CONTROLS:-authentication}"

# lib/ has to travel WITH this script. Copying api-deploy.sh alone leaves this
# looking for a helper that is not on the box, and bash exits before preflight
# with a bare "No such file or directory" - so say what is actually wrong.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for helper in git-sync migrate controls; do
  if [ ! -r "$SCRIPT_DIR/lib/$helper.sh" ]; then
    echo "missing $SCRIPT_DIR/lib/$helper.sh" >&2
    echo "Copy the whole scripts/deploy directory to the host, not just this file." >&2
    exit 1
  fi
done
# shellcheck source=lib/git-sync.sh
. "$SCRIPT_DIR/lib/git-sync.sh"
# shellcheck source=lib/migrate.sh
. "$SCRIPT_DIR/lib/migrate.sh"
# shellcheck source=lib/controls.sh
. "$SCRIPT_DIR/lib/controls.sh"
export PATH="$NODE_BIN:$PATH"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

say() { printf '\n=== %s ===\n' "$1"; }

cd "$REPO_DIR"

say "preflight"
node -v
# The commit this box is SERVING, which is not the same question as "what is
# HEAD". Read from the record written at the last verified cutover, before
# deploy_git_sync moves the tree - see deploy_deployed_sha for why HEAD alone is
# wrong on every retry, and why the stamped file written just below is not the
# record despite looking exactly like it.
DEPLOYED_SHA_RECORD="/tmp/api-deployed-sha.txt"
ROLLBACK_SHA="$(deploy_deployed_sha "$DEPLOYED_SHA_RECORD" "$REPO_DIR")"
echo "rollback sha: $ROLLBACK_SHA"
STAMP="$(date +%Y%m%d-%H%M%S)"
echo "$ROLLBACK_SHA" > "/tmp/api-rollback-$STAMP.txt"
tar czf "/tmp/api-dist-before-$STAMP.tgz" apps/backend/dist packages/*/dist 2>/dev/null || true
cp apps/backend/.env "/tmp/api-env-before-$STAMP" 2>/dev/null || true
echo "backups: /tmp/api-dist-before-$STAMP.tgz  /tmp/api-env-before-$STAMP"
# Where the schema-hazard notice is written in addition to stderr. Built here,
# with the other preflight artifacts, because stderr is the one destination that
# is guaranteed to be gone in the case the notice matters most: it is the ssh
# pipe, and the teardown of that connection is what kills this script. The
# rollback sha the notice hands the operator is already written next door.
HAZARD_LOG="/tmp/api-schema-hazard-$STAMP.txt"

say "checkout $GIT_REF"
# Fetch and checkout live in lib/git-sync.sh so their two failure modes - a stale
# parent ref breaking the whole fetch, and a qualified `origin/dev` being sent to
# the remote as a branch name - are covered by tests/git-sync.test.sh against a
# real remote, rather than only being found on a live box.
#
# REQUIRE_PROMOTED_FROM names the branch a commit must have reached before this
# host will run it. Set for production, empty for dev - dev is where things are
# meant to arrive first.
deploy_git_sync "$REPO_DIR" "$GIT_REF" "${REQUIRE_PROMOTED_FROM:-}"

# Before anything is installed, built or applied: name the migrations this
# deploy would add on top of what the box is serving. That set is exactly what a
# rollback to $ROLLBACK_SHA would leave applied, so it is what has to be said out
# loud if the deploy stops after the schema has moved.
INCOMING_MIGRATIONS="$(deploy_incoming_migrations "$ROLLBACK_SHA" HEAD)"
MIGRATIONS_APPLIED=0
CUTOVER_DONE=0
SMOKE_PID=""

if [ -n "$INCOMING_MIGRATIONS" ]; then
  echo "this deploy adds $(printf '%s\n' "$INCOMING_MIGRATIONS" | grep -c '') migration(s):"
  printf '%s\n' "$INCOMING_MIGRATIONS" | sed 's/^/  /'
else
  echo "this deploy adds no migrations - the schema does not move"
fi

# The handler itself is `deploy_on_exit` in lib/migrate.sh, so the test suite
# can arm the real one instead of a hand-written copy of it. The state it reads
# - MIGRATIONS_APPLIED, CUTOVER_DONE, ROLLBACK_SHA, INCOMING_MIGRATIONS - is set
# above; SMOKE_PID is set and cleared around the boot below.
#
# Why a trap at all: this script runs under `set -e`, so a command that simply
# fails ends it where it stands. Hanging the notice off the two branches that
# test a status meant every other exit between the migration and the cutover was
# silent - including the likeliest one of all, `prisma migrate deploy` halting
# part-way through and leaving the earlier migrations applied. An EXIT trap
# cannot be walked past. It also owns the smoke process, so there is one handler
# rather than an arm/disarm pair around the boot that a later edit could fall
# out of.

say "install"
pnpm install --frozen-lockfile

# The client, not the database. `prisma generate` reads schema.prisma and writes
# the typed client the build compiles against; it touches nothing live, so it is
# safe to run before the build has been proved. `prisma migrate deploy` is the
# irreversible half and waits until after it.
say "prisma client"
pnpm --filter @yosemite-crew/database run prisma:generate

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

# The point of no return, and the last step before it that can still fail
# harmlessly. Everything above this line is repeatable: a failed install, build
# or freshness check leaves the box exactly as it was found, serving the old
# bundle against the old schema. From here on it does not.
#
# The smoke boot below runs the new code, which needs the new schema, so this
# cannot move any later.
say "migrations"
if [ -n "$INCOMING_MIGRATIONS" ]; then
  echo "  applying, after which a rollback to $ROLLBACK_SHA no longer restores the box on its own"
fi
# Armed before the schema can move, and the flag is set before the command
# rather than after it: `prisma migrate deploy` halting on migration three of
# three has already applied two. Setting it after was the bug - the assignment
# was unreachable in exactly the case it described. It over-reports only if
# Prisma fails having applied nothing, and over-reporting a schema hazard is the
# safe direction. A deploy that carries no migrations cannot move the schema at
# all, so it stays silent.
#
# The arming itself is deploy_arm_exit_traps in lib/migrate.sh - EXIT plus TERM
# and HUP, with the reasoning next to it - so the suite can arm the real one and
# signal it rather than grep this file for three trap lines.
deploy_arm_exit_traps
if [ -n "$INCOMING_MIGRATIONS" ]; then
  MIGRATIONS_APPLIED=1
fi
pnpm --filter @yosemite-crew/database run prisma:deploy

say "smoke boot on :$SMOKE_PORT"
cd apps/backend
rm -f /tmp/api-smoke.log
PORT="$SMOKE_PORT" nohup node dist/index.js >/tmp/api-smoke.log 2>&1 &
SMOKE_PID=$!
sleep 25
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$SMOKE_PORT/health" || echo 000)"
echo "  /health -> $CODE"
# An app-level JSON body proves Express reached a real handler; Express's own
# HTML 404 on a bogus path proves the probe was not just hitting a catch-all.
echo "  real route : $(curl -s --max-time 10 "http://127.0.0.1:$SMOKE_PORT/v1/pet-passport/mobile/companion/probe" | head -c 60)"
echo "  bogus route: $(curl -s --max-time 10 "http://127.0.0.1:$SMOKE_PORT/v1/definitely-not-a-route" | head -c 30)"
# Every probe above is a GET, so nothing here parses a request body - and a
# bundle whose body parser is broken answers all of them correctly. #2690 moved
# `raw-body` across a major with two workspace patches to body-parser for the
# CommonJS/ESM interop; if that ever stops applying the symptom is
# `getBody is not a function` on every request CARRYING a body, which is a total
# write outage that /health reports as 200.
#
# POSTed to the path that matches nothing, on purpose: `express.json()` is
# mounted app-level (app.ts:161) ahead of registerRoutes (:178), so the body is
# parsed before routing, before auth and before any handler. So this exercises
# the parser while touching no route, no database and no credentials - and the
# smoke boot runs against the real database with migrations already applied,
# which is why "touches nothing" is the requirement.
#
# The content-type and the body are both load-bearing. `express.json()` decides
# by content-type, so a bare `curl -X POST` short-circuits the parser and
# returns the SAME 404 without ever calling raw-body - a probe that passes
# whether or not the thing it tests works. Measured on express 4.21.2 with
# body-parser 1.20.6:
#
#   no body, no content-type        -> 404   parser short-circuits
#   content-type json, valid body   -> 404   read path exercised
#   content-type json, invalid body -> 400
#   broken interop, any of the above -> 500
#
# Compared for EQUALITY with 404 rather than inequality with 500: a malformed
# body is a 400 and a hang is the 000 below, and `!= 500` would pass both.
POST_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST -H 'content-type: application/json' -d '{"smoke":true}' \
  "http://127.0.0.1:$SMOKE_PORT/v1/definitely-not-a-route" || echo 000)"
echo "  body parse -> $POST_CODE"
# Which security controls actually applied in THIS environment, read from the
# process that is about to serve traffic, while a rollback is still free.
#
# /health above is liveness and answers 200 for a process whose entire /auth
# surface is 404 - by design, since #2750 deliberately left it alone. The body
# is printed whatever it says; only a NAMED control reporting `failed` stops the
# cutover, and lib/controls.sh holds the reasoning for every case that does not.
# The 503 this returns when degraded is why there is no -f and no code check
# here: the body is the signal, not the status.
#
# The assignment below is deliberately NOT tolerant. An unreadable body ships -
# that decision is in lib/controls.sh - but a helper that cannot RUN stops the
# deploy here, because set -e carries a command substitution's status and the
# EXIT trap turns that into a stop notice with the rollback sha.
CONTROLS_BODY="$(curl -s --max-time 10 "http://127.0.0.1:$SMOKE_PORT/health/controls" || echo '')"
echo "  controls -> ${CONTROLS_BODY:-<unreachable>}"
CONTROL_FAILURES="$(deploy_blocking_control_failures "$CONTROLS_BODY" "$DEPLOY_BLOCKING_CONTROLS")"
# Reports, never gates - the `|| true` is what makes that true, and it is
# deliberate: this is a second signal for whoever reads the log, and POST_CODE
# above is the gate.
grep -iE 'ERR_REQUIRE_ESM|Cannot find module|FATAL ERROR|getBody is not a function' /tmp/api-smoke.log | head -5 || true
kill "$SMOKE_PID" 2>/dev/null || true
SMOKE_PID=""
sleep 2
if [ "$CODE" != "200" ]; then
  echo "smoke boot failed - NOT cutting over. Rollback sha: $ROLLBACK_SHA" >&2
  exit 1
fi

if [ "$POST_CODE" != "404" ]; then
  echo "smoke boot could not parse a request body ($POST_CODE, expected 404)" >&2
  echo "- every GET probe passes a bundle that 500s on every write." >&2
  echo "NOT cutting over. Rollback sha: $ROLLBACK_SHA" >&2
  exit 1
fi

if [ -n "$CONTROL_FAILURES" ]; then
  echo "smoke boot came up with a security control that FAILED to apply:" >&2
  while IFS= read -r control_failure; do
    echo "  $control_failure" >&2
  done <<< "$CONTROL_FAILURES"
  echo "- the process starts and /health answers 200 with the control absent." >&2
  echo "NOT cutting over. Rollback sha: $ROLLBACK_SHA" >&2
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
  || { echo "  NOTHING LISTENING on 8080 - roll back to $ROLLBACK_SHA" >&2
       exit 1; }
# Past here the running process IS the new code, so the schema being ahead of it
# is no longer true and the notice must stop claiming it.
CUTOVER_DONE=1
# The new code is now the thing answering, so this is the first moment it is
# true that the box serves this commit. Recorded here and nowhere earlier: every
# step above can still fail, and a record written before the cutover would
# describe a deploy that did not happen - which is the exact defect that made
# the preflight file unusable as a record.
deploy_record_deployed_sha "$DEPLOYED_SHA_RECORD" "$(git -C "$REPO_DIR" rev-parse HEAD)"

say "done"
echo "deployed $(git -C "$REPO_DIR" rev-parse --short HEAD)  (rollback: $ROLLBACK_SHA)"
