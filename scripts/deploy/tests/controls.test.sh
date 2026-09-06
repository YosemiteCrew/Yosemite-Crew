#!/usr/bin/env bash
#
# Regression tests for the cutover gate on startup controls.
#
# What is pinned here is not "does it parse JSON" but the SHIP list. A gate that
# blocks too much is not a safer gate - it refuses rollbacks and it turns a
# third-party outage into a stuck deploy - so every non-blocking case below is a
# deliberate decision from lib/controls.sh, and each one is a separate test
# because each one can be broken on its own.
#
# Usage: scripts/deploy/tests/controls.test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/../lib/controls.sh"

DEPLOY_SH="$HERE/../api-deploy.sh"

# api-deploy.sh with full-line comments BLANKED, line numbering preserved.
#
# Every guard below reads this rather than the file. The first version of the
# probe guard grepped the file and stayed green with the probe deleted, because
# the reasoning written above the probe names the same path twice - a check that
# could not see the thing it was named after, reporting on prose in the same
# file. Blanking rather than deleting keeps the line numbers, which the ordering
# guard needs. Trailing comments on code lines are left alone: stripping those
# means parsing quoting, and the failure that actually happened was a full-line
# one.
DEPLOY_CODE="$(sed -E 's/^[[:space:]]*#.*$//' "$DEPLOY_SH")"

PASS=0
FAIL=0

ok() { printf '  ok   %s\n' "$1"; PASS=$((PASS + 1)); }
no() { printf '  FAIL %s\n     %s\n' "$1" "$2"; FAIL=$((FAIL + 1)); }

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then ok "$1"; else no "$1" "expected '$2', got '$3'"; fi
}

# ships <name> <controls-json> [required-name...]
#
# "Ships" is TWO facts and empty output is only one of them. A helper that
# crashes also writes nothing to stdout, and a crash is the opposite of a ship:
# api-deploy.sh runs under set -e, so a non-zero status here stops the deploy.
# Asserting emptiness alone let four of these pass in a world where three of
# them stop the cutover - raised in review, and the exact distinction the
# node-missing probe below was already making in the other direction.
ships() {
  local name="$1" json="$2"
  shift 2
  local out rc=0
  out="$(deploy_blocking_control_failures "$json" "$*")" || rc=$?
  if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
    ok "$name"
  else
    no "$name" "expected an empty result and exit 0, got rc=$rc out='$out'"
  fi
}

# A body in the shape /health/controls actually returns. Built rather than
# pasted so a test cannot quietly assert against a body the endpoint never
# produces: name/state/detail and the `at` stamp are all present, and `status`
# is the aggregate the gate deliberately ignores.
body() { # body <status> <control-json>...
  local status="$1"
  shift
  local joined=""
  local part
  for part in "$@"; do
    [ -z "$joined" ] && joined="$part" || joined="$joined,$part"
  done
  printf '{"status":"%s","controls":[%s]}' "$status" "$joined"
}

# The same body with the declaration #2759 added: what this bundle registers
# before it answers on its port. Kept as a SEPARATE builder rather than an
# optional argument to body(), so that every existing fixture above stays a
# body with no `expected` key at all - which is the older-bundle case, and the
# one both API hosts actually return today.
body_declaring() { # body_declaring <status> <expected-names> <control-json>...
  local status="$1" expected="$2"
  shift 2
  local joined="" part
  for part in "$@"; do
    [ -z "$joined" ] && joined="$part" || joined="$joined,$part"
  done
  local declared="" name
  for name in $expected; do
    [ -z "$declared" ] && declared="\"$name\"" || declared="$declared,\"$name\""
  done
  printf '{"status":"%s","controls":[%s],"expected":[%s]}' \
    "$status" "$joined" "$declared"
}

control() { # control <name> <state> [detail]
  local name="$1" state="$2" detail="${3-}"
  if [ -n "$detail" ]; then
    printf '{"name":"%s","state":"%s","detail":"%s","at":"2026-09-05T23:00:00.000Z"}' \
      "$name" "$state" "$detail"
  else
    printf '{"name":"%s","state":"%s","at":"2026-09-05T23:00:00.000Z"}' "$name" "$state"
  fi
}

# The two blocking cases below are also the positive control for every SHIP
# case: they use fixtures of the same shape, so a body this suite could not
# parse at all would fail them rather than turning the ships into vacuous
# passes.
echo "deploy_blocking_control_failures"

# ---------------------------------------------------------------------------
# The case the gate exists for: the smoke boot came up with no authentication
# and said so, before cutover, while the rollback is still free.
# ---------------------------------------------------------------------------
check "blocks when a named control reports failed" \
  "authentication: failed (auth env incomplete)" \
  "$(deploy_blocking_control_failures \
      "$(body degraded "$(control authentication failed 'auth env incomplete')")" \
      authentication)"

check "names the control without a detail when the report carries none" \
  "authentication: failed" \
  "$(deploy_blocking_control_failures \
      "$(body degraded "$(control authentication failed)")" \
      authentication)"

# ---------------------------------------------------------------------------
# Everything below SHIPS, and each line is a decision rather than an oversight.
# ---------------------------------------------------------------------------

# Auth deliberately switched off is a deployment fact. Blocking on it would
# make the kill switch unusable, which is the same error as ignoring the
# endpoint entirely, pointing the other way.
ships "ships when the named control was deliberately skipped" \
  \
      "$(body ok "$(control authentication skipped 'disabled by configuration')")" \
      authentication

ships "ships when the named control applied" \
  \
      "$(body ok "$(control authentication applied)")" \
      authentication

# A rollback deploys a bundle from before the control existed. Blocking on an
# absent report would refuse the one deploy that most needs to work, so absence
# ships - and this is the gate's deliberate blind spot, not an accident.
ships "ships when the named control is absent, so a rollback is not refused" \
  \
      "$(body ok "$(control stream-upload-policy applied)")" \
      authentication

# The whole reason this is a named list and not the aggregate: `status` is
# already "degraded" in this body, and it must not stop the deploy.
ships "ships when an unnamed control failed, even though the aggregate is degraded" \
  \
      "$(body degraded "$(control stream-upload-policy failed 'updateAppSettings rejected')")" \
      authentication

# Both failed: one blocks, one does not, in a single body. The pair is what
# separates "reads the named control" from "reads the first control".
check "blocks on the named control only, when both named and unnamed failed" \
  "authentication: failed (auth env incomplete)" \
  "$(deploy_blocking_control_failures \
      "$(body degraded \
          "$(control stream-upload-policy failed 'updateAppSettings rejected')" \
          "$(control authentication failed 'auth env incomplete')")" \
      authentication)"

# A prefix match would block on this and be wrong. Exercised with a name that
# CONTAINS the required one, because a substring test passes every case above.
ships "matches a control name exactly rather than by prefix" \
  "$(body degraded "$(control authentication-provider failed 'rejected')")" \
  authentication

check "reports every named control that failed, not just the first" \
  "authentication: failed (auth env incomplete)
stream-upload-policy: failed (updateAppSettings rejected)" \
  "$(deploy_blocking_control_failures \
      "$(body degraded \
          "$(control authentication failed 'auth env incomplete')" \
          "$(control stream-upload-policy failed 'updateAppSettings rejected')")" \
      "authentication stream-upload-policy")"

# A name is a name. Nothing sets one containing a glob character, but the old
# variadic signature forced the caller to leave its list unquoted, and this is
# the reading of that list that a pathname expansion would have destroyed.
ships "treats a glob-shaped name as a literal name" \
  "$(body degraded "$(control authentication failed 'auth env incomplete')")" \
  '*'

# /health is the liveness gate and it runs first. A body this function cannot
# read is not a second chance to decide the process is dead.
ships "ships on a body that is not JSON" \
  '<html>502 Bad Gateway</html>' authentication

ships "ships on an empty body" \
  '' authentication

ships "ships on JSON without a controls array" \
  '{"status":"ok"}' authentication

ships "ships when no control is named as blocking" \
  \
      "$(body degraded "$(control authentication failed 'auth env incomplete')")"

# ---------------------------------------------------------------------------
# `expected` (#2761): absence alone still ships, but absence CONTRADICTED by the
# bundle's own declaration blocks.
#
# The three ship rows below are not padding around the block row - they are what
# stops this from being "block whenever the name is missing and the key is
# present", which passes the block row and every row above it. Each removes one
# of the three ways a name can be missing for a reason that is not a fault.
# ---------------------------------------------------------------------------
check "blocks when the bundle declared the control and never reported it" \
  "authentication: declared but never reported" \
  "$(deploy_blocking_control_failures \
      "$(body_declaring ok "authentication stream-upload-policy" \
          "$(control stream-upload-policy applied)")" \
      authentication)"

# The rollback case, now stated positively: this bundle publishes its list and
# the control is not on it, so it never claimed to record one. Distinguishing
# this from the row above is the whole point of reading the key, and a gate that
# ignored membership would block here and refuse the deploy.
ships "ships when \`expected\` omits the named control, so it was never claimed" \
  "$(body_declaring ok "stream-upload-policy" \
      "$(control stream-upload-policy applied)")" \
  authentication

# A declaration of the wrong shape is a body we cannot read, and an unreadable
# body ships. Without this row, `parsed.expected` being truthy would be enough,
# and a string is truthy and has .includes.
ships "ships when \`expected\` is present but not an array" \
  '{"status":"ok","controls":[],"expected":"authentication"}' \
  authentication

# Declared, reported, fine. The block row above must not be reachable by the
# declaration alone.
ships "ships when the control is declared and did report" \
  "$(body_declaring ok "authentication" "$(control authentication applied)")" \
  authentication

# Both kinds of failure in one body, so the two emit paths are separated: one
# control reported `failed`, the other declared and missing. A gate wired to
# only one of them passes one of the block rows above on its own.
check "reports a declared-and-missing control alongside one that reported failed" \
  "authentication: failed (auth env incomplete)
stream-upload-policy: declared but never reported" \
  "$(deploy_blocking_control_failures \
      "$(body_declaring degraded "authentication stream-upload-policy" \
          "$(control authentication failed 'auth env incomplete')")" \
      "authentication stream-upload-policy")"

# The bytes both API hosts returned on 2026-09-06, pasted rather than built -
# a pre-#2755 bundle, which is also what a rollback to any ref before it
# produces, so it must keep shipping.
#
# Stated honestly: no mutation of lib/controls.sh reddens this row without also
# reddening the body()-built absent row above it, and I could not construct one.
# It is subsumed. What it is here for is the fixture BUILDER: every other case
# in this file asserts against body() output, and a builder that drifted from
# the endpoint would take the whole suite with it. This row is the only input
# here that the endpoint actually produced.
ships "ships on the response shape a pre-#2755 bundle actually returns" \
  '{"status":"ok","controls":[{"name":"stream-upload-policy","state":"applied","at":"2026-09-04T22:21:40.663Z"}]}' \
  authentication

# ---------------------------------------------------------------------------
# The row the table above does not decide: an unreadable BODY ships, but an
# interpreter that will not start stops the deploy. api-deploy.sh runs under
# set -e and an assignment carries its command substitution's status, so this
# function returning non-zero is the stop.
#
# Run inside a command substitution so the stripped PATH cannot outlive the
# probe: a variable assignment preceding a FUNCTION call persists in bash, and
# the subshell is what contains it. PATH is checked afterwards rather than
# assumed.
# ---------------------------------------------------------------------------
FAILING_BODY="$(body degraded "$(control authentication failed 'auth env incomplete')")"
PATH_BEFORE="$PATH"

NODE_GONE_RC=0
NODE_GONE_OUT="$(PATH=/nonexistent-for-this-probe \
  deploy_blocking_control_failures "$FAILING_BODY" authentication 2>/dev/null)" \
  || NODE_GONE_RC=$?

if [ "$NODE_GONE_RC" -ne 0 ]; then
  ok "stops the deploy when the helper cannot run at all"
else
  no "stops the deploy when the helper cannot run at all" \
     "returned 0 with output '$NODE_GONE_OUT'"
fi

# The positive control for the probe above. Without it, a harness that broke the
# call in some other way would look exactly like a node that would not start.
check "the same body and a working node returns the blocking line" \
  "authentication: failed (auth env incomplete)" \
  "$(deploy_blocking_control_failures "$FAILING_BODY" authentication)"

check "the probe did not leak its stripped PATH into the rest of the suite" \
  "$PATH_BEFORE" \
  "$PATH"

echo
echo "api-deploy.sh wiring"

# The function is inert unless the script probes the endpoint and acts on the
# result. Each of these three has been forgotten separately in review of similar
# gates: probing but not gating, gating but never probing, and gating on the
# aggregate `status` after all.
# Matched on the curl itself, not on the string /health/controls: the reasoning
# above the probe names that path twice, so a bare string search stays green
# with the probe deleted. It did, the first time this was written.
# Anchored to the shape of the STATEMENT, not to a substring anywhere on the
# line. Blanking full-line comments left one costume uncovered: a trailing
# comment on a code line - `CONTROLS_BODY=""  # was: curl … /health/controls` -
# satisfied both this guard and the ordering one, because PROBE_LINE resolved to
# the comment and the comment is still above the kill. Third instance of the
# same bug; this closes it without parsing quoting.
PROBE_RE='^[[:space:]]*CONTROLS_BODY="\$\(curl .*SMOKE_PORT/health/controls'
if grep -qE "$PROBE_RE" <<< "$DEPLOY_CODE"; then
  ok "api-deploy.sh curls /health/controls"
else
  no "api-deploy.sh curls /health/controls" "no curl of that path in the file"
fi

if grep -q 'DEPLOY_BLOCKING_CONTROLS:-authentication' <<< "$DEPLOY_CODE"; then
  ok "authentication is a blocking control by default"
else
  no "authentication is a blocking control by default" \
     "no DEPLOY_BLOCKING_CONTROLS default naming it"
fi

if grep -q 'deploy_blocking_control_failures' <<< "$DEPLOY_CODE"; then
  ok "api-deploy.sh asks which named controls block the cutover"
else
  no "api-deploy.sh asks which named controls block the cutover" \
     "the helper is never called"
fi

if awk '/if \[ -n "\$CONTROL_FAILURES" \]/,/^fi$/' <<< "$DEPLOY_CODE" | grep -q 'exit 1'; then
  ok "a blocking control failure stops the cutover"
else
  no "a blocking control failure stops the cutover" \
     "no exit 1 guarded by CONTROL_FAILURES"
fi

# The probe has to happen while the smoke process is still up. Ordering is the
# whole of it: after the kill, the curl answers 000 and the gate is decorative.
# `|| true` because set -o pipefail turns "no match" into an abort, which would
# stop the run before this test could report - a deleted probe would then be a
# missing result rather than a failure.
# `|| true` on the assignment would turn the stop above into a ship, which is
# the one regression that cannot be seen by running the function.
ASSIGN_LINE="$(grep -nE 'CONTROL_FAILURES=.*deploy_blocking_control_failures' <<< "$DEPLOY_CODE" || true)"
if [ -n "$ASSIGN_LINE" ] && ! printf '%s' "$ASSIGN_LINE" | grep -q '||'; then
  ok "the helper's exit status is not swallowed at the call site"
else
  no "the helper's exit status is not swallowed at the call site" \
     "assignment line: ${ASSIGN_LINE:-<not found>}"
fi

if grep -qE 'deploy_blocking_control_failures "[^"]*CONTROLS_BODY" "[^"]*DEPLOY_BLOCKING_CONTROLS"' \
  <<< "$DEPLOY_CODE"; then
  ok "the blocking-control list is passed as one quoted argument"
else
  no "the blocking-control list is passed as one quoted argument" \
     "an unquoted list is also a pathname expansion; see lib/controls.sh"
fi

PROBE_LINE="$(grep -nE "$PROBE_RE" <<< "$DEPLOY_CODE" | head -1 | cut -d: -f1 || true)"
KILL_LINE="$(grep -nE 'kill .*SMOKE_PID' <<< "$DEPLOY_CODE" | head -1 | cut -d: -f1 || true)"
if [ -n "$PROBE_LINE" ] && [ -n "$KILL_LINE" ] && [ "$PROBE_LINE" -lt "$KILL_LINE" ]; then
  ok "the controls probe runs before the smoke process is killed"
else
  no "the controls probe runs before the smoke process is killed" \
     "probe=$PROBE_LINE kill=$KILL_LINE"
fi

echo
printf '%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
