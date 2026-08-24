#!/usr/bin/env bash
#
# Move a deploy checkout onto a requested ref.
#
# Extracted from api-deploy.sh so the two failure modes below can be tested
# against a real remote instead of only being discovered on a live box.
#
# deploy_git_sync <repo-dir> <git-ref>
#
# Echoes the resolved short SHA. Returns non-zero if the ref cannot be resolved -
# the caller runs under `set -e`, and a deploy that cannot find its ref must stop
# rather than build whatever happens to be checked out.

deploy_git_sync() {
  local repo_dir="${1:?repo dir required}"
  local git_ref="${2:?git ref required}"

  cd "$repo_dir" || return 1

  # Accept `dev` or `origin/dev`. The remote is added back below, so passing the
  # qualified form asked the remote for a branch literally named `origin/dev`,
  # which does not exist, and the deploy stopped at "couldn't find remote ref".
  git_ref="${git_ref#origin/}"

  # Prune first, on its own, every time.
  #
  # When a remote branch is deleted upstream the box keeps its remote-tracking
  # ref. If a branch is later created UNDER that name - `fix` deleted, then
  # `fix/passport-under-health` created - git cannot write
  # refs/remotes/origin/fix/* while a ref still sits at refs/remotes/origin/fix.
  # Every child fails to lock and takes the whole fetch down with it, including
  # the unrelated ref the deploy actually wanted. That is what stopped the first
  # real run of this script.
  #
  # This is a separate step rather than `fetch --prune` because a fetch that
  # names a single refspec only prunes within that refspec: `fetch --prune
  # origin dev` succeeds while leaving the dead parent in place, so the box stays
  # armed for the next caller that needs a full fetch. Clearing it unconditionally
  # repairs the checkout instead of stepping around it.
  git remote prune origin >/dev/null 2>&1 || true

  git fetch --quiet --prune origin "$git_ref" || git fetch --quiet --prune origin

  local resolved
  resolved="$(git rev-parse --verify --quiet "origin/$git_ref" \
    || git rev-parse --verify --quiet "$git_ref")" || {
    echo "could not resolve '$git_ref' (or 'origin/$git_ref') after fetch" >&2
    return 1
  }

  git checkout --detach "$resolved" --quiet
  git rev-parse --short HEAD
}
