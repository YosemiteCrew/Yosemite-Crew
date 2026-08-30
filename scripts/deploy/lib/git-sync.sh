#!/usr/bin/env bash
#
# Move a deploy checkout onto a requested ref.
#
# Extracted from api-deploy.sh so the two failure modes below can be tested
# against a real remote instead of only being discovered on a live box.
#
# deploy_git_sync <repo-dir> <git-ref> [promotion-branch]
#
# Echoes the resolved short SHA. Returns non-zero if the ref cannot be resolved -
# the caller runs under `set -e`, and a deploy that cannot find its ref must stop
# rather than build whatever happens to be checked out.
#
# With a promotion-branch, the resolved commit must be an ancestor of that
# branch or the deploy stops BEFORE the checkout. See
# deploy_assert_ref_promoted for why that constraint exists.

# deploy_assert_ref_promoted <candidate-sha> <promotion-branch>
#
# Refuse a commit that has not reached the promotion branch.
#
# The workflow resolves `TARGET_REF="${REF:-$DEFAULT_REF}"`, where DEFAULT_REF is
# `main` for production but REF is a free-text dispatch input that overrides it.
# The `production` environment's branch policy does NOT close this: it restricts
# which branch the WORKFLOW runs from, not the ref the box checks out. So a
# production deploy dispatched from main could, and on 2026-08-30 did, put
# commits on the production box that were only ever on `dev` - `ce855cf9d` at
# 11:42Z and `fd60d539d` at 11:47Z, while `main` was still `7f92970d8`. The
# promotion that carried them landed at 12:08Z, twenty minutes later.
#
# Nobody merged to main to do that; the deploy simply went around the promotion.
# This is the check that makes the branch policy mean what it appears to mean.
#
# Deploying an OLDER main commit stays allowed - that is a rollback, and an
# ancestor of the promotion branch. Only never-promoted work is refused.
deploy_assert_ref_promoted() {
  local candidate="${1:?candidate commit required}"
  local promotion_branch="${2:?promotion branch required}"

  promotion_branch="${promotion_branch#origin/}"

  # deploy_git_sync fetches only the ref being deployed, so the box's
  # origin/<promotion_branch> can be arbitrarily stale. Fetch it explicitly.
  # A stale one would fail this check rather than pass it - ancestry against an
  # older branch head is a subset - so the failure mode is closed, not open.
  git fetch --quiet origin "$promotion_branch" || {
    echo "could not fetch '$promotion_branch' to check promotion" >&2
    return 1
  }

  local promoted_head
  promoted_head="$(git rev-parse --verify --quiet "origin/$promotion_branch")" || {
    echo "could not resolve 'origin/$promotion_branch' after fetch" >&2
    return 1
  }

  if git merge-base --is-ancestor "$candidate" "$promoted_head"; then
    return 0
  fi

  {
    echo "refusing to deploy $(git rev-parse --short "$candidate"): it is not an" \
      "ancestor of origin/$promotion_branch."
    echo "That commit has not been promoted. Merge it to $promotion_branch first," \
      "then deploy."
  } >&2
  return 1
}

deploy_git_sync() {
  local repo_dir="${1:?repo dir required}"
  local git_ref="${2:?git ref required}"
  local promotion_branch="${3:-}"

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

  # Before the checkout, not after: a refused deploy must leave the box on the
  # commit it was already serving, not on unpromoted code with the build half
  # done.
  if [ -n "$promotion_branch" ]; then
    deploy_assert_ref_promoted "$resolved" "$promotion_branch" || return 1
  fi

  git checkout --detach "$resolved" --quiet
  git rev-parse --short HEAD
}
