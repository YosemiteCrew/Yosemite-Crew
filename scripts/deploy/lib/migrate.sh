#!/usr/bin/env bash
#
# Which migrations a deploy is about to introduce, and what that costs if the
# deploy does not finish.
#
# api-deploy.sh cannot cut over before it has proved the new bundle boots, and
# it cannot prove that without the new schema, so there is a window in which the
# OLD process serves traffic against the NEW schema. The window is not the
# problem on its own - a failed deploy is, because the script deliberately does
# not cut over, and the rollback it prints restores the CODE. Nothing rolls back
# the schema, so the old process stays on an incompatible one indefinitely.
#
# Shrinking that window is api-deploy.sh's job (it applies migrations after the
# build rather than before it, so a build failure - the common one on the 1.9 GB
# dev box - never reaches the database at all). Saying what is still exposed
# when a deploy stops is this file's job.
#
# Extracted so it can be tested against a real git history rather than only
# being found on a live box, the same reason lib/git-sync.sh exists.

# deploy_incoming_migrations <from-sha> [to-ref]
#
# Echoes, one per line, the migration directory names that <to-ref> adds on top
# of <from-sha>. Must be run inside the repository.
#
# The filesystem is the right source here rather than the database. Migrations
# are append-only - .github/workflows/_migration.yaml fails a pull request that
# edits or deletes an applied one - so a diff between the commit the box is
# serving and the commit being deployed names exactly the migrations that a
# rollback to the former would leave stranded. Migrations older than <from-sha>
# are already covered by the running code, whether or not this box has applied
# them yet.
#
# Two-dot on purpose. A rollback deploys an older ref, where the newer
# migrations are deletions rather than additions, and correctly reports none: a
# rollback applies no new schema.
deploy_incoming_migrations() {
  local from="${1:?commit currently deployed required}"
  local to="${2:-HEAD}"

  git rev-parse --verify --quiet "$from^{commit}" >/dev/null || {
    echo "deploy_incoming_migrations: cannot resolve '$from'" >&2
    return 1
  }

  git diff --no-renames --diff-filter=A --name-only "$from..$to" \
    -- packages/database/prisma/migrations \
    | sed -n -E 's#^packages/database/prisma/migrations/([^/]+)/migration\.sql$#\1#p' \
    | sort
}

# deploy_on_exit
#
# The EXIT trap api-deploy.sh installs before it lets the schema move.
#
# Lives here rather than in api-deploy.sh because the test that proves the
# notice survives `set -e` cannot run api-deploy.sh - it wants pm2, node, a
# database and a box. It used to hand-write its own copy of this handler, which
# meant the only thing tying the copy to the real one was a grep on line
# ordering, and transposing the two flags in the real one left the whole suite
# green while inverting the notice: fires only after a verified cutover, silent
# exactly when the schema is ahead. Three positional flags of the same type and
# nothing to catch a swap. Now there is one handler, so there is one place for
# the order to be wrong and a test that exercises it.
#
# Reads the caller's state rather than taking arguments, because an EXIT trap
# has no arguments to take. Callers must set MIGRATIONS_APPLIED, CUTOVER_DONE,
# ROLLBACK_SHA and INCOMING_MIGRATIONS before arming it; under `set -u` a
# missing one aborts loudly, which is the right direction - the alternative is a
# default, and the only sensible default for "did the schema move" is the silent
# one.
#
# SMOKE_PID is the exception and IS defaulted: no smoke process is a normal
# state for most of the script's life, not a caller mistake. HAZARD_LOG is
# supplied by deploy_arm_exit_traps rather than demanded here - see
# deploy_schema_hazard_notice for why neither of the obvious options works.
# deploy_arm_exit_traps
#
# Installs every trap the deploy needs, in one place, because the arming is as
# easy to get wrong as the handler and was not covered by anything that runs.
#
# Lives here rather than in api-deploy.sh for the reason the handler does: a
# test cannot run api-deploy.sh - it wants pm2, node, a database and a box - so
# the arming could only ever be checked by grepping the real file for the trap
# lines. That is a stand-in tied to the original by a grep, which is the exact
# shape #2718 removed from the handler. With the arming in a function, the suite
# arms the real one in a real bash process and signals it.
#
# TERM and HUP are trapped alongside EXIT, and the reason is not symmetry. An
# untrapped fatal signal ends the shell without giving the EXIT trap a non-zero
# status to see, so the notice was silent on exactly the two signals a cancelled
# deploy arrives as: the runner kills the local ssh client, the connection
# closes, and sshd sends SIGHUP to this process group. The exit status is
# preserved as 143 and 129, so nothing downstream reads a different result.
# SIGINT already worked - bash sets the status to 130 itself.
#
# SIGKILL stays out of reach. No trap catches it, so the ceiling is every signal
# that can be trapped, not "the notice can no longer be lost".
#
# A trapped signal is also deferred until the running foreground command
# finishes, where an untrapped one ends the shell where it stands. On a cancel
# that costs nothing - the child is in the same process group and dies too - and
# on a bare `kill` of this shell it means an in-flight `prisma migrate deploy`
# runs to completion before the deploy stops, which is the safer of the two.
deploy_arm_exit_traps() {
  # A destination, always. Unset or empty meant no durable write at all, which
  # is not a safe fallback - it is the fix turned off, silently, leaving the
  # notice on the one destination that is gone in the case it exists for.
  # `$$` rather than a fixed name so two deploys on one box cannot collide;
  # api-deploy.sh overrides this with the $STAMP-keyed path that matches the
  # rollback sha and the dist tarball it already writes.
  HAZARD_LOG="${HAZARD_LOG:-/tmp/api-schema-hazard-$$.txt}"

  trap 'exit 143' TERM
  trap 'exit 129' HUP
  trap deploy_on_exit EXIT
}

deploy_on_exit() {
  local status=$?

  if [ -n "${SMOKE_PID:-}" ]; then
    kill "$SMOKE_PID" 2>/dev/null || true
  fi

  # Deliberate word splitting - one argument per migration. Prisma directory
  # names are <timestamp>_<snake_case>, so there is nothing here to glob.
  # shellcheck disable=SC2086
  deploy_stop_notice "$status" "$MIGRATIONS_APPLIED" "$CUTOVER_DONE" \
    "$ROLLBACK_SHA" $INCOMING_MIGRATIONS
}

# deploy_stop_notice <exit-status> <migrations-applied> <cutover-done> <rollback-sha> <migration>...
#
# Whether an exiting deploy owes the operator the hazard notice.
#
# Separated from the notice text because the two failed independently: the
# wording was right while the notice was unreachable on the path most likely to
# need it. api-deploy.sh runs under `set -e`, so a bare command failure ends the
# script where it stands - it does not fall through to a call site further
# down. `prisma migrate deploy` applies migrations one at a time and halts at
# the first failure, leaving the earlier ones applied, which is precisely the
# state the notice exists to announce and precisely the state that skipped it.
#
# So the caller installs this on an EXIT trap instead of calling it from the
# branches it remembered to cover, and the decision lives here where it can be
# tested without a live box.
#
# Silent on a clean exit, on a deploy whose schema never moved, and after a
# verified cutover - past that point the running code is the new code, so the
# schema being ahead of it is no longer true.
deploy_stop_notice() {
  local status="${1:?exit status required}"
  local applied="${2:?migrations-applied flag required}"
  local cutover="${3:?cutover-done flag required}"
  local rollback_sha="${4:?rollback sha required}"
  shift 4

  if [ "$status" = "0" ]; then return 0; fi
  if [ "$applied" != "1" ]; then return 0; fi
  if [ "$cutover" = "1" ]; then return 0; fi

  deploy_schema_hazard_notice "$rollback_sha" "$@"
}

# deploy_schema_hazard_text <rollback-sha> <migration>...
#
# The wording, on stdout, so the two destinations below write the same bytes.
# Separated from the destinations because they have different failure modes:
# the wording cannot fail, and writing it can.
deploy_schema_hazard_text() {
  local rollback_sha="${1:?rollback sha required}"
  shift

  {
    echo
    echo "!!! THE SCHEMA IS AHEAD OF THE RUNNING CODE."
    echo
    echo "This deploy applied ${#} migration(s) and then did NOT cut over, so the"
    echo "process still serving traffic is the OLD one, now running against the NEW"
    echo "schema. Checking out $rollback_sha restores the code and does NOT undo any"
    echo "of this:"
    printf '  %s\n' "$@"
    echo
    echo "If any of them removed or renamed something the running code still names,"
    echo "every request touching it is failing NOW and will keep failing. Either fix"
    echo "forward and re-deploy, or write and apply a migration that reverses them."
    echo "Prisma has no down-migration; there is nothing to run that undoes this by"
    echo "itself."
  }
}

# deploy_schema_hazard_notice <rollback-sha> <migration>...
#
# What to say when the deploy stops after the schema has moved, and where.
#
# Two destinations, and the ORDER between them is load-bearing rather than
# stylistic. stderr on the box is the ssh pipe, and the teardown of that
# connection is what sends the SIGHUP this notice most needs to survive - so by
# the time the handler runs, the reader may already be gone. Writing into a pipe
# with no reader takes SIGPIPE and ends the handler where it stands, so anything
# sequenced after the stderr write does not happen at all.
#
# Measured against the real handler, HUP to the process group, the only variable
# being the order of the two writes:
#
#   reader gone,  file then stderr -> exit 141, 590 bytes on disk
#   reader gone,  stderr then file -> exit 141,   0 bytes on disk
#   reader alive, either order     -> exit 129, 590 bytes on disk
#
# The exit status is 141 in both failing cases, so nothing downstream can tell
# the two apart. The order is the whole of it.
#
# HAZARD_LOG is neither demanded nor allowed to be missing, which is the third
# option and the only one that is not a trap. Demanding it under `set -u` would
# abort the handler on the path the notice exists for - destroying it to enforce
# a rule about keeping it. Letting it be empty turns the durable write off
# silently. So deploy_arm_exit_traps supplies one, and a caller that armed the
# traps cannot reach this function without a destination.
deploy_schema_hazard_notice() {
  local rollback_sha="${1:?rollback sha required}"
  shift

  local text
  text="$(deploy_schema_hazard_text "$rollback_sha" "$@")"

  # `|| true` because a destination that cannot be written must not cost the
  # other one. A full disk here would otherwise end the handler under `set -e`.
  # `/dev/null` rather than an `if`, because a caller that armed the traps always
  # has a destination and the branch would be one no mutation could redden.
  printf '%s\n' "$text" >> "${HAZARD_LOG:-/dev/null}" 2>/dev/null || true

  printf '%s\n' "$text" >&2
}
