#!/usr/bin/env bash
# Resolve the commit that affected-detection diffs HEAD against.
#
# The event context arrives through the environment rather than through workflow
# expressions so this logic can be unit tested (see compute-base-sha.bats)
# instead of living inline in a workflow step.
#
# Emits two key=value lines on stdout for the caller to append to $GITHUB_OUTPUT:
#   sha=<commit>    base to diff from; empty when run_all is true
#   run_all=<bool>  true when no trustworthy base exists, so CI must run everything
#
# Fail-closed contract: any path that cannot prove its base is a real commit in
# this checkout sets run_all=true. No path may return HEAD. A base equal to HEAD
# yields an empty diff, which is what let pushes to dev report green having
# built and tested nothing.

set -euo pipefail

readonly ZERO_SHA='0000000000000000000000000000000000000000'

event_name="${GITHUB_EVENT_NAME:-}"
event_before="${EVENT_BEFORE:-}"
pr_base_sha="${PR_BASE_SHA:-}"
merge_group_base_sha="${MERGE_GROUP_BASE_SHA:-}"
force_push_base="${FORCE_PUSH_BASE:-}"

emit() {
  printf 'sha=%s\n' "$1"
  printf 'run_all=%s\n' "$2"
}

# A base is usable only if the object is present in this checkout. Shallow
# clones and commits that a force-push orphaned both fail here.
is_commit() {
  [ -n "$1" ] && [ "$1" != "$ZERO_SHA" ] && git cat-file -e "$1^{commit}" 2>/dev/null
}

# An explicit operator override wins over every inferred base.
if [ -n "$force_push_base" ]; then
  if is_commit "$force_push_base"; then
    emit "$force_push_base" false
    exit 0
  fi
  echo "force_push_base '$force_push_base' is not a commit in this checkout" >&2
  emit '' true
  exit 0
fi

# Branch creation is the one case with legitimately no previous tip: the push
# carries the zero SHA, so HEAD~1 is the only sensible base. It under-reports a
# multi-commit first push, which is accepted because it fires once, at branch
# creation, off the steady-state path.
#
# Everything else that cannot be resolved runs all workspaces. In particular a
# push whose `before` is a real SHA that is absent from this checkout means the
# history was rewritten by a force push: falling back to HEAD~1 there would
# narrow the diff to the final commit and silently skip every workspace touched
# earlier in the pushed range.
if [ "$event_name" = "push" ] && { [ -z "$event_before" ] || [ "$event_before" = "$ZERO_SHA" ]; }; then
  parent="$(git rev-parse --verify --quiet 'HEAD~1' 2>/dev/null || true)"
  if is_commit "$parent"; then
    emit "$parent" false
    exit 0
  fi
  echo "branch creation with no parent commit; running all workspaces" >&2
  emit '' true
  exit 0
fi

case "$event_name" in
  pull_request | pull_request_target)
    candidate="$pr_base_sha"
    ;;
  merge_group)
    candidate="$merge_group_base_sha"
    ;;
  push)
    # github.event.before is the branch tip prior to this push, and is the only
    # correct base on a push to a base branch: `git merge-base origin/<branch>
    # HEAD` resolves to HEAD itself there, producing the empty-diff false green.
    candidate="$event_before"
    ;;
  *)
    candidate=''
    ;;
esac

if is_commit "$candidate"; then
  emit "$candidate" false
  exit 0
fi

echo "no trustworthy base for event '$event_name'; running all workspaces" >&2
emit '' true
