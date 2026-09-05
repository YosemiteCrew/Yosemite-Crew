#!/usr/bin/env bash
#
# Regression tests for the migration half of the deploy.
#
# What is pinned here is which migrations a deploy is about to introduce, since
# that is the set a code rollback would leave applied - the sentence the
# operator reads when a deploy stops without cutting over. Driven against a real
# git history rather than a mocked one, for the same reason git-sync.test.sh is:
# the answer is a property of `git diff` semantics, not of our wrapper.
#
# Usage: scripts/deploy/tests/migrate.test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/../lib/migrate.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAIL=0

ok() { printf '  ok   %s\n' "$1"; PASS=$((PASS + 1)); }
no() { printf '  FAIL %s\n     %s\n' "$1" "$2"; FAIL=$((FAIL + 1)); }

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then ok "$1"; else no "$1" "expected '$2', got '$3'"; fi
}

git_quiet() { git -c init.defaultBranch=main -c user.email=t@t -c user.name=t "$@"; }

REPO="$WORK/repo"

add_migration() { # add_migration <name> [sql]
  local name="$1" sql="${2:-SELECT 1;}"
  mkdir -p "$REPO/packages/database/prisma/migrations/$name"
  printf '%s\n' "$sql" > "$REPO/packages/database/prisma/migrations/$name/migration.sql"
  git_quiet -C "$REPO" add -A
  git_quiet -C "$REPO" commit --quiet -m "add $name"
  git -C "$REPO" rev-parse HEAD
}

git_quiet init --quiet "$REPO"
mkdir -p "$REPO/packages/database/prisma/migrations"
echo readme > "$REPO/README.md"
git_quiet -C "$REPO" add -A
git_quiet -C "$REPO" commit --quiet -m "root"
ROOT="$(git -C "$REPO" rev-parse HEAD)"

M1="$(add_migration 20260101000000_first)"
M2="$(add_migration 20260102000000_second)"
M3="$(add_migration 20260103000000_third)"

cd "$REPO"

echo "deploy_incoming_migrations"

# ---------------------------------------------------------------------------
# The ordinary deploy: the box is on an older commit, and every migration added
# since is one a code rollback would leave applied.
# ---------------------------------------------------------------------------
check "reports the migrations added since the deployed commit" \
  "20260102000000_second
20260103000000_third" \
  "$(deploy_incoming_migrations "$M1" "$M3")"

check "reports nothing when the box is already on the deployed commit" \
  "" \
  "$(deploy_incoming_migrations "$M3" "$M3")"

check "reports every migration when the box predates them all" \
  "20260101000000_first
20260102000000_second
20260103000000_third" \
  "$(deploy_incoming_migrations "$ROOT" "$M3")"

# ---------------------------------------------------------------------------
# A rollback applies no new schema. Two-dot rather than three-dot is what makes
# this true: deploying an older ref sees the newer migrations as deletions.
# ---------------------------------------------------------------------------
check "a rollback to an older ref introduces no migrations" \
  "" \
  "$(deploy_incoming_migrations "$M3" "$M1")"

# ---------------------------------------------------------------------------
# Only migration.sql counts. A README or a lock file inside the migrations tree
# changes no schema, and reporting one would tell an operator their schema had
# moved when it had not.
# ---------------------------------------------------------------------------
mkdir -p "$REPO/packages/database/prisma/migrations/20260104000000_notes"
echo "provider = postgresql" > "$REPO/packages/database/prisma/migrations/migration_lock.toml"
echo "notes" > "$REPO/packages/database/prisma/migrations/20260104000000_notes/README.md"
git_quiet -C "$REPO" add -A
git_quiet -C "$REPO" commit --quiet -m "non-sql files"
NON_SQL="$(git -C "$REPO" rev-parse HEAD)"

check "a directory with no migration.sql is not a migration" \
  "" \
  "$(deploy_incoming_migrations "$M3" "$NON_SQL")"

# ---------------------------------------------------------------------------
# Changes elsewhere in the repo, and edits to an EXISTING migration, are not
# new migrations. The immutability gate in _migration.yaml already refuses the
# latter on a pull request; this makes sure a deploy does not double-count one
# that reached the box some other way.
# ---------------------------------------------------------------------------
echo "app change" > "$REPO/apps-file.txt"
printf 'SELECT 2;\n' > "$REPO/packages/database/prisma/migrations/20260101000000_first/migration.sql"
git_quiet -C "$REPO" add -A
git_quiet -C "$REPO" commit --quiet -m "edit an applied migration and an app file"
EDITED="$(git -C "$REPO" rev-parse HEAD)"

check "an edited migration is not reported as a new one" \
  "" \
  "$(deploy_incoming_migrations "$NON_SQL" "$EDITED")"

# ---------------------------------------------------------------------------
# A rename is a delete plus an add, so the added half IS a migration the box has
# not applied under that name - Prisma keys applied migrations by directory
# name. --no-renames is what makes it visible.
# ---------------------------------------------------------------------------
git_quiet -C "$REPO" mv \
  packages/database/prisma/migrations/20260103000000_third \
  packages/database/prisma/migrations/20260105000000_third_renamed
git_quiet -C "$REPO" commit --quiet -m "rename a migration"
RENAMED="$(git -C "$REPO" rev-parse HEAD)"

check "a renamed migration is reported under its new name" \
  "20260105000000_third_renamed" \
  "$(deploy_incoming_migrations "$EDITED" "$RENAMED")"

# ---------------------------------------------------------------------------
# Two-dot rather than three-dot, the case where they disagree.
#
# The box is on `dev`; production deploys `main`. A migration that reached dev
# first and was then promoted to main is present in BOTH trees and is not new to
# this box. Three-dot compares the merge base to the target, so it would report
# that migration as incoming and put it in a schema-hazard notice describing a
# schema move that already happened - the operator is then told to reverse a
# migration their running code depends on.
# ---------------------------------------------------------------------------
git_quiet -C "$REPO" checkout --quiet -b promoted "$M2"
git_quiet -C "$REPO" checkout --quiet -b box "$M2"
BOX="$(add_migration 20260110000000_shared)"
git_quiet -C "$REPO" checkout --quiet promoted
# The two branches have to actually diverge. Cherry-picking onto the same parent
# with the same tree, author and second reproduces the SAME sha, and the
# scenario collapses into "deploying the commit already running".
echo "promoted only" > "$REPO/promoted-only.txt"
git_quiet -C "$REPO" add -A
git_quiet -C "$REPO" commit --quiet -m "a commit that only main has"
git_quiet -C "$REPO" cherry-pick "$BOX" >/dev/null
TARGET="$(git -C "$REPO" rev-parse HEAD)"

[ "$TARGET" != "$BOX" ] || { echo "setup error: the branches did not diverge" >&2; exit 1; }

check "a migration already on the box is not reported when it arrives by another route" \
  "" \
  "$(deploy_incoming_migrations "$BOX" "$TARGET")"

git_quiet -C "$REPO" checkout --quiet "$RENAMED"

# ---------------------------------------------------------------------------
# An unresolvable commit must fail rather than quietly report "no migrations",
# and must say so. Reporting an empty set for a commit that could not be read
# would tell the operator the schema had not moved.
# ---------------------------------------------------------------------------
BAD_ERR="$(deploy_incoming_migrations "0000000000000000000000000000000000000000" HEAD 2>&1 >/dev/null || true)"

if deploy_incoming_migrations "0000000000000000000000000000000000000000" HEAD >/dev/null 2>&1; then
  no "an unresolvable commit fails" "it returned 0"
else
  ok "an unresolvable commit fails rather than reporting an empty set"
fi

case "$BAD_ERR" in
  *"cannot resolve"*) ok "an unresolvable commit says which one" ;;
  *) no "an unresolvable commit says which one" "stderr was: $BAD_ERR" ;;
esac

echo
echo "deploy_schema_hazard_notice"

NOTICE="$(deploy_schema_hazard_notice abc1234 20260102000000_second 20260103000000_third 2>&1)"

case "$NOTICE" in
  *"20260102000000_second"*) ok "names every stranded migration" ;;
  *) no "names every stranded migration" "$NOTICE" ;;
esac

case "$NOTICE" in
  *"abc1234"*) ok "names the code rollback it does not undo" ;;
  *) no "names the code rollback it does not undo" "$NOTICE" ;;
esac

check "counts the migrations it lists" "2" \
  "$(printf '%s\n' "$NOTICE" | grep -oE 'applied [0-9]+ migration' | grep -oE '[0-9]+')"

# The whole point of the notice is that it goes to stderr next to the failure,
# not to stdout where a `$(...)` capture would swallow it.
if [ -z "$(deploy_schema_hazard_notice abc1234 m1 2>/dev/null)" ]; then
  ok "writes to stderr, not stdout"
else
  no "writes to stderr, not stdout" "something reached stdout"
fi

echo
echo "deploy_stop_notice"

# The notice text was never the defect. The defect was that it could not be
# reached on the path most likely to need it, so what is pinned here is when it
# fires - each condition separately, and then the `set -e` behaviour that made
# the original unreachable.

fired() { # fired <status> <applied> <cutover>
  if [ -n "$(deploy_stop_notice "$1" "$2" "$3" abc1234 20260102000000_second 2>&1 >/dev/null)" ]; then
    echo yes
  else
    echo no
  fi
}

check "fires when a failed deploy left migrations applied before cutover" \
  "yes" "$(fired 1 1 0)"
check "silent on a clean exit" "no" "$(fired 0 1 0)"
check "silent when the schema never moved" "no" "$(fired 1 0 0)"
check "silent once the cutover is verified" "no" "$(fired 1 1 1)"
check "a non-1 failure status still fires" "yes" "$(fired 127 1 0)"

STOP_NOTICE="$(deploy_stop_notice 1 1 0 abc1234 20260102000000_second 20260103000000_third 2>&1 >/dev/null)"
case "$STOP_NOTICE" in
  *20260102000000_second*20260103000000_third*) ok "passes every migration through to the notice" ;;
  *) no "passes every migration through to the notice" "$STOP_NOTICE" ;;
esac

echo
echo "deploy_on_exit"

# The handler api-deploy.sh actually arms, exercised directly.
#
# deploy_stop_notice takes three positional flags of the same type, and nothing
# - not the shell, not shellcheck - catches a transposition. The suite could
# not either, while the test hand-wrote its own copy of this handler and the
# only thing tying the copy to the real one was a grep on line ordering.
# Swapping the two flags in the real handler inverts the notice completely:
# fires only after a verified cutover, silent exactly when the schema is ahead.
#
# So each flag is varied independently against the real function. It reads the
# caller's state rather than taking arguments, because an EXIT trap has none.
# Matches the NOTICE, not merely "something reached stderr". A `set -u` abort
# inside the handler also writes to stderr, and reading that as "the notice
# fired" would make three of the four checks below pass for the wrong reason -
# and turn red for the wrong reason too, which is worse. `|| true` because a
# probe that dies must report as a failed check rather than end the suite.
on_exit_fired() { # on_exit_fired <status> <migrations-applied> <cutover-done>
  local out
  out="$(
    MIGRATIONS_APPLIED="$2" \
    CUTOVER_DONE="$3" \
    ROLLBACK_SHA=abc1234 \
    INCOMING_MIGRATIONS="20260102000000_second" \
    bash -c '
      set -u
      . "'"$HERE"'/../lib/migrate.sh"
      ( exit '"$1"' )
      deploy_on_exit
    ' 2>&1 >/dev/null || true
  )"
  case "$out" in
    *"THE SCHEMA IS AHEAD OF THE RUNNING CODE"*) echo yes ;;
    *) echo no ;;
  esac
}

check "the real handler fires when migrations applied and no cutover" \
  "yes" "$(on_exit_fired 1 1 0)"
check "the real handler is silent after a verified cutover" \
  "no" "$(on_exit_fired 1 1 1)"
check "the real handler is silent when the schema never moved" \
  "no" "$(on_exit_fired 1 0 0)"
check "the real handler is silent on a clean exit" \
  "no" "$(on_exit_fired 0 1 0)"

# The two silent cases above are what make a transposition red: swapping
# MIGRATIONS_APPLIED and CUTOVER_DONE turns "silent after a verified cutover"
# into a notice and "fires when migrations applied" into silence.

ON_EXIT_OUT="$(
  MIGRATIONS_APPLIED=1 CUTOVER_DONE=0 ROLLBACK_SHA=deadbee \
  INCOMING_MIGRATIONS="20260102000000_second 20260103000000_third" \
  bash -c '
    set -u
    . "'"$HERE"'/../lib/migrate.sh"
    ( exit 1 )
    deploy_on_exit
  ' 2>&1 >/dev/null || true
)"
case "$ON_EXIT_OUT" in
  *deadbee*20260102000000_second*20260103000000_third*)
    ok "the real handler passes the rollback sha and every migration through" ;;
  *) no "the real handler passes the rollback sha and every migration through" \
       "$ON_EXIT_OUT" ;;
esac

# SMOKE_PID is the one piece of state the handler defaults, because "no smoke
# process" is a normal state for most of the script rather than a caller
# mistake. Everything else is deliberately undefaulted so `set -u` refuses
# rather than silently choosing the silent answer.
if MIGRATIONS_APPLIED=1 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
   INCOMING_MIGRATIONS="20260102000000_second" \
   bash -c '
     set -u
     . "'"$HERE"'/../lib/migrate.sh"
     ( exit 1 )
     deploy_on_exit
   ' >/dev/null 2>&1; then
  ok "the real handler tolerates an unset SMOKE_PID"
else
  no "the real handler tolerates an unset SMOKE_PID" "it failed under set -u"
fi

# The handler has TWO jobs, and every check above exercises only one. Deleting
# the kill outright left the whole suite green, which made "the smoke process is
# reaped on any exit" a claim the comment makes and nothing tests. The stakes
# are a deploy that fails for a reason nothing in its output names: an orphaned
# smoke process holds :8099, so the NEXT deploy's boot cannot bind, /health
# answers 000 and it correctly refuses to cut over - failing closed, and failing
# opaque.
#
# `wait` rather than `kill -0`, because a killed child is a zombie until it is
# reaped and `kill -0` reports a zombie as alive. The status distinguishes the
# two outcomes: 143 is SIGTERM, 0 is "it ran to completion untouched".
SMOKE_WAIT_STATUS="$(
  MIGRATIONS_APPLIED=0 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
  INCOMING_MIGRATIONS="" \
  bash -c '
    set -u
    . "'"$HERE"'/../lib/migrate.sh"
    sleep 2 &
    SMOKE_PID=$!
    deploy_on_exit
    wait "$SMOKE_PID" 2>/dev/null
    echo "$?"
  ' 2>/dev/null || echo aborted
)"
check "the real handler kills the smoke process" "143" "$SMOKE_WAIT_STATUS"

# And the kill must not be able to swallow the notice. api-deploy.sh runs under
# `set -e`, so an unguarded `kill` of a process that has already exited would
# end the handler where it stands - before the notice, on the exit path the
# notice exists for. `|| true` is what stops that, and nothing tested it.
DEAD_PID_NOTICE="$(
  MIGRATIONS_APPLIED=1 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
  INCOMING_MIGRATIONS="20260102000000_second" \
  bash -c '
    set -eu
    . "'"$HERE"'/../lib/migrate.sh"
    sleep 0 &
    SMOKE_PID=$!
    wait "$SMOKE_PID" 2>/dev/null || true
    trap deploy_on_exit EXIT
    false
  ' 2>&1 >/dev/null || true
)"
case "$DEAD_PID_NOTICE" in
  *"THE SCHEMA IS AHEAD OF THE RUNNING CODE"*)
    ok "a smoke process that has already exited does not swallow the notice" ;;
  *) no "a smoke process that has already exited does not swallow the notice" \
       "stderr was: $DEAD_PID_NOTICE" ;;
esac

# The reap runs BEFORE the notice, and that order is load-bearing rather than
# stylistic. Moving the kill below the notice is green today - every branch of
# deploy_stop_notice returns 0, so nothing after it is skipped. But under
# `set -e` the day one of them returns non-zero, a handler in that order stops
# at the notice and never reaps, and neither change on its own fails anything:
# the reorder is green now, and the `return 1` would be green in a handler that
# reaps first. This pins the order by supplying the half that does not exist
# yet.
#
# It stubs both sides deliberately - `kill` so the ordering is observable
# without a real child, deploy_stop_notice so it can fail - and runs the real
# deploy_on_exit between them. So it testifies about the order of the two
# statements and nothing else; that the kill actually kills is the check above,
# which is why both are here.
REAP_ORDER="$(
  MIGRATIONS_APPLIED=1 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
  INCOMING_MIGRATIONS="20260102000000_second" \
  bash -c '
    set -eu
    . "'"$HERE"'/../lib/migrate.sh"
    kill() { echo REAPED; }
    deploy_stop_notice() { echo NOTICE; return 1; }
    SMOKE_PID=4242
    trap deploy_on_exit EXIT
    false
  ' 2>/dev/null || true
)"
check "the reap cannot be swallowed by a notice that fails" \
  "REAPED NOTICE" "$(printf '%s' "$REAP_ORDER" | tr '\n' ' ' | sed 's/ $//')"

# ---------------------------------------------------------------------------
# The notice has to survive being killed, and survive its own destination.
#
# An untrapped fatal signal ends the shell without handing the EXIT trap a
# non-zero status, so the notice was silent on exactly the two signals a
# cancelled deploy arrives as. SIGINT was already covered - bash sets the status
# to 130 itself - and SIGKILL never can be.
#
# Armed through the real deploy_arm_exit_traps rather than by re-typing its
# three trap lines here, so removing a trap from the shipped function is what
# turns these red. Grepping api-deploy.sh for the trap lines instead would tie a
# stand-in to the original by a string match - the shape #2718 removed from the
# handler, arriving one level up in the arming.
#
# Signalled with a plain `kill` of the script rather than of its process group,
# because a group signal would reach this suite too. That is also the slower of
# the two paths on purpose: a trapped signal is deferred until the running
# foreground command finishes, so the `sleep 1` below is what the deferral costs
# and the check would be worthless without something in flight to defer behind.
# ---------------------------------------------------------------------------
echo
echo "deploy signal traps"

signalled_notice() { # signalled_notice <signal> <expected-status>
  local sig="$1" ready="$WORK/ready.$1" out="$WORK/out.$1" pid status
  rm -f "$ready" "$out"
  HAZARD_LOG="$WORK/hazard.$1.txt" \
  MIGRATIONS_APPLIED=1 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
  INCOMING_MIGRATIONS="20260102000000_second" \
  bash -c '
    set -euo pipefail
    . "'"$HERE"'/../lib/migrate.sh"
    deploy_arm_exit_traps
    echo ready > "'"$ready"'"
    sleep 1
  ' > /dev/null 2>"$out" &
  pid=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -s "$ready" ] && break
    sleep 0.2
  done
  kill "-$sig" "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null
  status=$?
  case "$(cat "$out")" in
    *"THE SCHEMA IS AHEAD OF THE RUNNING CODE"*) echo "$status fired" ;;
    *) echo "$status silent" ;;
  esac
}

check "SIGTERM reaches the notice, with its status preserved" \
  "143 fired" "$(signalled_notice TERM)"
check "SIGHUP reaches the notice, with its status preserved" \
  "129 fired" "$(signalled_notice HUP)"

# ---------------------------------------------------------------------------
# And the destination. stderr on the box is the ssh pipe, and the teardown of
# that connection is what sends the SIGHUP - so the reader is gone in the case
# the notice matters most, the write takes SIGPIPE, and the handler ends there.
#
# The fifo below is opened while a reader still exists, because opening one for
# writing blocks until it has a reader; the reader is killed afterwards, which
# is what makes the write fail. Then the ordinary destination test, so that a
# green result here cannot mean "the file write never happens at all".
# ---------------------------------------------------------------------------
HAZ_PLAIN="$WORK/hazard-plain.txt"
: > "$HAZ_PLAIN"
HAZARD_LOG="$HAZ_PLAIN" \
MIGRATIONS_APPLIED=1 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
INCOMING_MIGRATIONS="20260102000000_second" \
bash -c '
  set -u
  . "'"$HERE"'/../lib/migrate.sh"
  ( exit 1 )
  deploy_on_exit
' >/dev/null 2>&1 || true
case "$(cat "$HAZ_PLAIN")" in
  *"THE SCHEMA IS AHEAD OF THE RUNNING CODE"*)
    ok "the notice is written to the durable destination as well as stderr" ;;
  *) no "the notice is written to the durable destination as well as stderr" \
       "the file holds: $(cat "$HAZ_PLAIN")" ;;
esac

HAZ_PIPE="$WORK/hazard-brokenpipe.txt"
FIFO="$WORK/stderr.fifo"
rm -f "$FIFO"; mkfifo "$FIFO"
: > "$HAZ_PIPE"
cat "$FIFO" > /dev/null &
FIFO_READER=$!
BROKEN_READY="$WORK/ready.pipe"
rm -f "$BROKEN_READY"
HAZARD_LOG="$HAZ_PIPE" \
MIGRATIONS_APPLIED=1 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
INCOMING_MIGRATIONS="20260102000000_second" \
bash -c '
  set -euo pipefail
  . "'"$HERE"'/../lib/migrate.sh"
  deploy_arm_exit_traps
  echo ready > "'"$BROKEN_READY"'"
  sleep 1
' >/dev/null 2>"$FIFO" &
BROKEN_PID=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do
  [ -s "$BROKEN_READY" ] && break
  sleep 0.2
done
kill -9 "$FIFO_READER" 2>/dev/null || true
wait "$FIFO_READER" 2>/dev/null || true
kill -TERM "$BROKEN_PID" 2>/dev/null || true
wait "$BROKEN_PID" 2>/dev/null || true

case "$(cat "$HAZ_PIPE")" in
  *"THE SCHEMA IS AHEAD OF THE RUNNING CODE"*)
    ok "the notice survives an stderr whose reader has gone" ;;
  *) no "the notice survives an stderr whose reader has gone" \
       "the file holds: $(cat "$HAZ_PIPE")" ;;
esac

# A caller that arms the traps and names no destination still gets one. Unset
# used to mean no durable write at all - not a safe fallback but the fix turned
# off, silently, leaving the notice on the destination that is gone in the case
# it exists for. api-deploy.sh names a $STAMP-keyed path so the file sits beside
# the rollback sha; this is what happens when someone edits that line away.
# Written to a file rather than passed to `bash -c`, the way the deploy-shape
# fixture below is: the variables it reads must expand in the inner shell, and a
# single-quoted `-c` argument holding them is what shellcheck reads as an
# expression that will not expand.
#
# `env -u` rather than an assignment, because HAZARD_LOG has to be genuinely
# absent here and not merely empty.
cat > "$WORK/default-dest.sh" <<DEFAULTDEST
#!/usr/bin/env bash
set -euo pipefail
. "$HERE/../lib/migrate.sh"
deploy_arm_exit_traps
echo "\$HAZARD_LOG"
exit 1
DEFAULTDEST
chmod +x "$WORK/default-dest.sh"

DEFAULT_DEST="$(
  env -u HAZARD_LOG \
  MIGRATIONS_APPLIED=1 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
  INCOMING_MIGRATIONS="20260102000000_second" \
  "$WORK/default-dest.sh" 2>/dev/null || true
)"
if [ -n "$DEFAULT_DEST" ] && [ -s "$DEFAULT_DEST" ] \
   && grep -q "THE SCHEMA IS AHEAD OF THE RUNNING CODE" "$DEFAULT_DEST"; then
  ok "arming supplies a durable destination when the caller names none"
  rm -f "$DEFAULT_DEST"
else
  no "arming supplies a durable destination when the caller names none" \
     "destination was '$DEFAULT_DEST'"
fi

# The other half of `${HAZARD_LOG:-...}`, and the half that was lost. The
# restructure that moved the traps into the library retired four source-level
# checks correctly - runtime checks replaced them - and retired a fifth by
# accident, because a diff cannot tell those two apart and I was reading the
# count rather than the names. What went was the assertion that api-deploy.sh
# names the destination before arming, and with it went any red for moving or
# deleting that line.
#
# Behavioural rather than positional this time: the caller's value has to
# survive the arming. If it does not, the notice still lands - the default
# catches it - but it stops being keyed to the same $STAMP as
# /tmp/api-rollback-$STAMP.txt and /tmp/api-dist-before-$STAMP.tgz, so an
# operator correlating one deploy's artifacts loses the link and nothing fails.
CALLER_DEST="$(
  HAZARD_LOG="$WORK/caller-named.txt" \
  MIGRATIONS_APPLIED=0 CUTOVER_DONE=0 ROLLBACK_SHA=abc1234 \
  INCOMING_MIGRATIONS="" \
  bash -c '
    set -euo pipefail
    . "'"$HERE"'/../lib/migrate.sh"
    deploy_arm_exit_traps
    echo "$HAZARD_LOG"
  ' 2>/dev/null || true
)"
check "arming does not override a destination the caller named" \
  "$WORK/caller-named.txt" "$CALLER_DEST"

# ---------------------------------------------------------------------------
# The regression itself.
#
# api-deploy.sh runs under `set -euo pipefail`. `prisma migrate deploy` applies
# migrations one at a time and halts at the first failure, having applied the
# earlier ones - a bare non-zero exit, not a status this script tests. The
# original hung the notice off two `if` branches further down, so `set -e` ended
# the script before either was reached and the operator was told nothing.
#
# Driven through a real bash process rather than by calling the function,
# because what is under test is that an EXIT trap survives `set -e` where a call
# site below the failure does not.
# ---------------------------------------------------------------------------
cat > "$WORK/deploy-shape.sh" <<SHAPE
#!/usr/bin/env bash
set -euo pipefail
. "$HERE/../lib/migrate.sh"

MIGRATIONS_APPLIED=0
CUTOVER_DONE=0
ROLLBACK_SHA=abc1234
INCOMING_MIGRATIONS="20260102000000_second"

# The REAL handler, armed the way api-deploy.sh arms it. A hand-written copy
# here is what let a transposition of its two flags stay green.
trap deploy_on_exit EXIT
MIGRATIONS_APPLIED=1
# Stands in for prisma halting part-way: two applied, then a bare failure.
echo "applied 20260101000000_first"
echo "applied 20260102000000_second"
false
echo "UNREACHABLE"
SHAPE
chmod +x "$WORK/deploy-shape.sh"

SHAPE_ERR="$("$WORK/deploy-shape.sh" 2>&1 >/dev/null || true)"
SHAPE_OUT="$("$WORK/deploy-shape.sh" 2>/dev/null || true)"

case "$SHAPE_ERR" in
  *"THE SCHEMA IS AHEAD OF THE RUNNING CODE"*)
    ok "a bare command failure under set -e still reaches the notice" ;;
  *) no "a bare command failure under set -e still reaches the notice" \
       "stderr was: $SHAPE_ERR" ;;
esac

case "$SHAPE_OUT" in
  *UNREACHABLE*) no "the failing command still ends the deploy" "it kept going" ;;
  *) ok "the failing command still ends the deploy" ;;
esac

if "$WORK/deploy-shape.sh" >/dev/null 2>&1; then
  no "the deploy still exits non-zero" "it returned 0"
else
  ok "the deploy still exits non-zero"
fi

# ---------------------------------------------------------------------------
# And the same invariant on the real file, since the behaviour above is only
# the notice's if api-deploy.sh keeps this order: arm the trap, then raise the
# flag, then move the schema. Setting the flag after the command was the bug -
# the assignment was unreachable in exactly the case it described.
# ---------------------------------------------------------------------------
DEPLOY_SH="$HERE/../api-deploy.sh"
# `|| true` so a missing line reports as a failed check rather than aborting
# the whole suite through `set -e` on the assignment below.
line_of() { grep -n -m1 -F "$1" "$DEPLOY_SH" | cut -d: -f1 || true; }
# Whole-line, because the first substring match for `deploy_arm_exit_traps` in
# that file is the COMMENT above the call. Deleting the call outright left this
# check green, found by mutating it: a check that matches prose rather than code
# reports on the documentation of the thing it is meant to pin.
line_of_exact() { grep -n -m1 -x "$1" "$DEPLOY_SH" | cut -d: -f1 || true; }

TRAP_LINE="$(line_of_exact 'deploy_arm_exit_traps')"
FLAG_LINE="$(line_of 'MIGRATIONS_APPLIED=1')"
DEPLOY_LINE="$(line_of 'run prisma:deploy')"

if [ -n "$TRAP_LINE" ] && [ -n "$FLAG_LINE" ] && [ -n "$DEPLOY_LINE" ] \
   && [ "$TRAP_LINE" -lt "$FLAG_LINE" ] && [ "$FLAG_LINE" -lt "$DEPLOY_LINE" ]; then
  ok "api-deploy.sh arms the traps and raises the flag before applying migrations"
else
  no "api-deploy.sh arms the traps and raises the flag before applying migrations" \
     "trap=$TRAP_LINE flag=$FLAG_LINE deploy=$DEPLOY_LINE"
fi

# The $STAMP keying, which only a string match can carry: the behavioural check
# above proves the caller's value survives the arming, and this proves
# api-deploy.sh still names one. Whole-line, for the same reason line_of_exact
# exists - the substring form matches the comment above the assignment.
# The literal dollar is escaped in double quotes rather than written inside
# single ones: `'$STAMP'` is an expansion that deliberately will not happen,
# which is precisely what SC2016 warns about and cannot be spelled otherwise.
STAMP_TOKEN="\$STAMP"
HAZARD_LINE="$(line_of "HAZARD_LOG=\"/tmp/api-schema-hazard-${STAMP_TOKEN}.txt\"")"
if [ -n "$HAZARD_LINE" ]; then
  ok "api-deploy.sh keys the durable destination to the preflight \$STAMP"
else
  no "api-deploy.sh keys the durable destination to the preflight \$STAMP" \
     "no assignment naming /tmp/api-schema-hazard-\$STAMP.txt"
fi

# The one thing left that a string match has to carry: that the script calls the
# arming function at all. Everything the function DOES is exercised above
# against the real function, so this pins the call site and nothing else - which
# is the smallest seam available, since no test can run api-deploy.sh itself.

if grep -q 'trap - EXIT' "$DEPLOY_SH"; then
  no "api-deploy.sh keeps one exit handler" "it disarms the EXIT trap somewhere"
else
  ok "api-deploy.sh keeps one exit handler rather than an arm/disarm pair"
fi

echo
printf '%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
