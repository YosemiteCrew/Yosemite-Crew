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

# deploy_schema_hazard_notice <rollback-sha> <migration>...
#
# What to say when the deploy stops after the schema has moved. Written to
# stderr beside the code rollback, because the code rollback on its own reads as
# if the box has been restored, and it has not.
deploy_schema_hazard_notice() {
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
  } >&2
}
