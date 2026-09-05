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

# deploy_deployed_sha <record-file> [repo-dir]
#
# The commit this box is actually serving, for use as the rollback target and as
# the `from` of deploy_incoming_migrations. Echoes a sha; never fails.
#
# WHY NOT `git rev-parse HEAD`, which is what this replaced. HEAD is the commit
# the working tree is on, and after deploy_git_sync that is the commit being
# DEPLOYED, not the one being served. On a first attempt the two coincide,
# because HEAD is read before the checkout. On a RETRY after any failure at or
# after the checkout - install, build, migration, smoke boot, cutover - the repo
# is already on the target, so HEAD reads back the target and two things break
# at once:
#
#   * deploy_incoming_migrations gets from == to and returns EMPTY, so
#     MIGRATIONS_APPLIED stays 0 and the schema-hazard notice cannot fire while
#     prisma is re-applying the still-pending migrations, and
#   * every "roll back to $ROLLBACK_SHA" message names the sha being deployed,
#     which is not a missing warning but a wrong instruction, printed at the
#     moment someone is deciding what to do.
#
# WHY NOT /tmp/api-rollback-$STAMP.txt, which already exists and looks exactly
# like this record. It is written in preflight, unconditionally, before anything
# can fail - so a failed attempt writes one too, carrying the same stale sha.
# Reading the newest of those rebuilds the defect inside its own fix, and does
# it silently. The record has to be written on a VERIFIED CUTOVER and nowhere
# else, which is what deploy_record_deployed_sha is for.
#
# Fixed filename rather than stamped, for the same reason: "the newest of the
# stamped files" is a sort over a directory that also holds every failure.
#
# The recorded sha is re-verified against this repository before it is trusted.
# A box restored from a backup, re-cloned, or carrying a record from a branch
# that has since been force-pushed would otherwise hand an unresolvable sha to
# deploy_incoming_migrations, which fails closed and takes the deploy with it.
# An unusable record is treated as no record.
deploy_deployed_sha() {
  local record="${1:?record file required}"
  local repo="${2:-.}"
  local recorded=""

  # -f as well as -r: a directory is readable, and `tr` would put "Is a
  # directory" on the deploy's stderr on the way to the right answer.
  if [ -f "$record" ] && [ -r "$record" ]; then
    recorded="$(tr -d " \t\r\n" < "$record")"
  fi

  # A SHA, not a revision. `git rev-parse --verify` resolves anything git can
  # name, so a record holding "dev" or "HEAD" would come back as the tip - which
  # is the commit being DEPLOYED, the exact value this function exists to stop
  # returning, arriving through the check meant to prevent it. Only reachable
  # through a corrupted or hand-edited record, which is precisely the case this
  # function's own comment anticipates. Raised by ankit-yc on #2732.
  #
  # Nearly, but not entirely, subsumed by the prefix comparison below: "dev" and
  # "HEAD" resolve to something that does not begin with themselves, so the
  # comparison would reject them too. One input still tells the two apart - a
  # VALID short abbreviation, the first six characters of a real sha, which the
  # comparison accepts and this rejects. Keeping it is the deliberate choice: a
  # six-character prefix is one collision away from ambiguity as the repo grows,
  # and falling back to HEAD is the safe answer when the record is that thin.
  # An earlier version of this comment called the class dead; it is not, and the
  # abbreviation above is the counterexample that reddens it.
  if [ "${#recorded}" -lt 7 ]; then
    recorded=""
  fi

  # Shape is necessary and not sufficient: a BRANCH whose name is seven or more
  # hex characters passes every check above and is then resolved as a ref, so
  # `deadbeef` comes back as whatever that branch points at. Raised by ankit-yc
  # on #2733 after the shape guard landed.
  #
  # So the value is COMPARED rather than described: resolve it, then require the
  # resolved sha to begin with what was recorded. That subsumes the hex-character
  # class this replaced - a name git resolves to something not beginning with it
  # is rejected whatever characters it holds. A ref cannot satisfy that unless it
  # happens to be named after its own target's prefix, in which case the ref and
  # the object agree and accepting it costs nothing - a coincidence rather than a
  # hole, and the reason this is a comparison and not a ban on names that look
  # like shas.
  #
  # `"$recorded"*` and not `$recorded*`: the expansion is quoted so a record
  # holding `*`, `?` or `[a-f]` is compared literally rather than as a pattern.
  #
  # NOT PINNED BY THE SUITE, deliberately, and this is the honest reason rather
  # than an omission: no input can tell the two spellings apart here. To reach
  # the comparison a record must first RESOLVE, and a value git resolves is a
  # sha or a ref name, neither of which can contain a glob metacharacter - so
  # unquoting it is green on every input I could construct. Tests asserting
  # otherwise were written for this and deleted when the mutation stayed green.
  # The quoting stays because it is free and correct, not because it is proven.
  if [ -n "$recorded" ]; then
    local resolved
    resolved="$(git -C "$repo" rev-parse --verify --quiet "$recorded^{commit}" 2>/dev/null || true)"
    case "$resolved" in
      "$recorded"*) printf '%s\n' "$resolved"; return 0 ;;
    esac
  fi

  # No usable record: a first-ever deploy on this box, or one written before
  # this function existed. HEAD is correct here and ONLY here, because this is
  # read before the checkout moves it.
  git -C "$repo" rev-parse HEAD
}

# deploy_record_deployed_sha <record-file> <sha>
#
# Remember what this box is serving, called once the new code is verifiably the
# thing answering - not before. Everything upstream of the cutover can still
# fail, and a record written earlier would describe a deploy that never
# happened, which is the failure this whole pair exists to end.
#
# Written to a temporary file and moved into place so a box killed mid-write
# keeps the previous record rather than a truncated one. A record that cannot be
# written is reported and does not fail the deploy: the cutover has already
# succeeded by this point, and losing the deploy over a note about it would be
# the tail wagging the dog. The cost is a stale record, which
# deploy_deployed_sha already treats as no record.
deploy_record_deployed_sha() {
  local record="${1:?record file required}"
  local sha="${2:?deployed sha required}"

  if printf '%s\n' "$sha" > "$record.tmp" && mv -f "$record.tmp" "$record"; then
    return 0
  fi

  echo "warning: could not record the deployed sha to $record" >&2
  rm -f "$record.tmp" 2>/dev/null || true
  return 0
}

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

  # What the suite proves about this write, and what it does not. It proves a
  # durable write happens, that it happens before the stderr write, and that the
  # caller's destination survives the arming. It does NOT prove the `|| true`
  # earns its place, that appending rather than truncating matters, or that the
  # `$$` in the default is load-bearing - mutating any of those three leaves the
  # suite green. They are reasoned, not pinned, and a reader should not credit
  # 41 green with covering them.
  #
  # `|| true` because a destination that cannot be written must not cost the
  # other one. A full disk here would otherwise end the handler under `set -e`.
  # `/dev/null` rather than an `if`, because a caller that armed the traps always
  # has a destination and the branch would be one no mutation could redden.
  printf '%s\n' "$text" >> "${HAZARD_LOG:-/dev/null}" 2>/dev/null || true

  printf '%s\n' "$text" >&2
}
