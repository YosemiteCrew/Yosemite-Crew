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

PASS=0
FAIL=0

ok() { printf '  ok   %s\n' "$1"; PASS=$((PASS + 1)); }
no() { printf '  FAIL %s\n     %s\n' "$1" "$2"; FAIL=$((FAIL + 1)); }

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then ok "$1"; else no "$1" "expected '$2', got '$3'"; fi
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
check "ships when the named control was deliberately skipped" \
  "" \
  "$(deploy_blocking_control_failures \
      "$(body ok "$(control authentication skipped 'disabled by configuration')")" \
      authentication)"

check "ships when the named control applied" \
  "" \
  "$(deploy_blocking_control_failures \
      "$(body ok "$(control authentication applied)")" \
      authentication)"

# A rollback deploys a bundle from before the control existed. Blocking on an
# absent report would refuse the one deploy that most needs to work, so absence
# ships - and this is the gate's deliberate blind spot, not an accident.
check "ships when the named control is absent, so a rollback is not refused" \
  "" \
  "$(deploy_blocking_control_failures \
      "$(body ok "$(control stream-upload-policy applied)")" \
      authentication)"

# The whole reason this is a named list and not the aggregate: `status` is
# already "degraded" in this body, and it must not stop the deploy.
check "ships when an unnamed control failed, even though the aggregate is degraded" \
  "" \
  "$(deploy_blocking_control_failures \
      "$(body degraded "$(control stream-upload-policy failed 'updateAppSettings rejected')")" \
      authentication)"

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
check "matches a control name exactly rather than by prefix" \
  "" \
  "$(deploy_blocking_control_failures \
      "$(body degraded "$(control authentication-provider failed 'rejected')")" \
      authentication)"

check "reports every named control that failed, not just the first" \
  "authentication: failed (auth env incomplete)
stream-upload-policy: failed (updateAppSettings rejected)" \
  "$(deploy_blocking_control_failures \
      "$(body degraded \
          "$(control authentication failed 'auth env incomplete')" \
          "$(control stream-upload-policy failed 'updateAppSettings rejected')")" \
      authentication stream-upload-policy)"

# /health is the liveness gate and it runs first. A body this function cannot
# read is not a second chance to decide the process is dead.
check "ships on a body that is not JSON" \
  "" \
  "$(deploy_blocking_control_failures '<html>502 Bad Gateway</html>' authentication)"

check "ships on an empty body" \
  "" \
  "$(deploy_blocking_control_failures '' authentication)"

check "ships on JSON without a controls array" \
  "" \
  "$(deploy_blocking_control_failures '{"status":"ok"}' authentication)"

check "ships when no control is named as blocking" \
  "" \
  "$(deploy_blocking_control_failures \
      "$(body degraded "$(control authentication failed 'auth env incomplete')")")"

echo
echo "api-deploy.sh wiring"

# The function is inert unless the script probes the endpoint and acts on the
# result. Each of these three has been forgotten separately in review of similar
# gates: probing but not gating, gating but never probing, and gating on the
# aggregate `status` after all.
# Matched on the curl itself, not on the string /health/controls: the reasoning
# above the probe names that path twice, so a bare string search stays green
# with the probe deleted. It did, the first time this was written.
PROBE_RE='curl .*SMOKE_PORT/health/controls'
if grep -qE "$PROBE_RE" "$DEPLOY_SH"; then
  ok "api-deploy.sh curls /health/controls"
else
  no "api-deploy.sh curls /health/controls" "no curl of that path in the file"
fi

if grep -q 'DEPLOY_BLOCKING_CONTROLS:-authentication' "$DEPLOY_SH"; then
  ok "authentication is a blocking control by default"
else
  no "authentication is a blocking control by default" \
     "no DEPLOY_BLOCKING_CONTROLS default naming it"
fi

if grep -q 'deploy_blocking_control_failures' "$DEPLOY_SH"; then
  ok "api-deploy.sh asks which named controls block the cutover"
else
  no "api-deploy.sh asks which named controls block the cutover" \
     "the helper is never called"
fi

if grep -qE 'CONTROL_FAILURES.*exit 1|exit 1.*CONTROL_FAILURES' "$DEPLOY_SH" \
  || awk '/if \[ -n "\$CONTROL_FAILURES" \]/,/^fi$/' "$DEPLOY_SH" | grep -q 'exit 1'; then
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
PROBE_LINE="$(grep -nE "$PROBE_RE" "$DEPLOY_SH" | head -1 | cut -d: -f1 || true)"
KILL_LINE="$(grep -nE 'kill .*SMOKE_PID' "$DEPLOY_SH" | head -1 | cut -d: -f1 || true)"
if [ -n "$PROBE_LINE" ] && [ -n "$KILL_LINE" ] && [ "$PROBE_LINE" -lt "$KILL_LINE" ]; then
  ok "the controls probe runs before the smoke process is killed"
else
  no "the controls probe runs before the smoke process is killed" \
     "probe=$PROBE_LINE kill=$KILL_LINE"
fi

echo
printf '%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
