#!/usr/bin/env bash
#
# Regression tests for deploy_git_sync, run against a real temporary remote.
#
# Both cases below actually happened on the dev API box and deployed nothing
# while the deploy step still looked like it had run. Neither is expressible as
# a unit test with a mocked git - they are refspec and ref-locking semantics, so
# the test builds a bare remote and a clone and drives real git.
#
# Usage: scripts/deploy/tests/git-sync.test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/../lib/git-sync.sh"

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

# A bare remote with a `dev` branch, plus a `fix` branch that is later deleted and
# replaced by branches nested under that same name.
setup_remote() {
  local remote="$WORK/remote.git" seed="$WORK/seed"
  rm -rf "$remote" "$seed"
  git_quiet init --quiet --bare "$remote"
  git_quiet clone --quiet "$remote" "$seed" 2>/dev/null
  (
    cd "$seed"
    echo one > file.txt
    git_quiet add file.txt
    git_quiet commit --quiet -m "one"
    git_quiet push --quiet origin HEAD:refs/heads/dev
    git_quiet push --quiet origin HEAD:refs/heads/fix
  )
  # Point the bare repo's HEAD at a branch that exists, so a clone lands on a
  # commit. Without this the default HEAD names a branch that was never pushed,
  # clones come up empty, and `rev-parse HEAD` has nothing to read.
  git_quiet -C "$remote" symbolic-ref HEAD refs/heads/dev
  echo "$remote"
}

# A working copy that has already fetched, so it holds refs/remotes/origin/fix.
setup_clone() {
  local remote="$1" clone="$WORK/clone"
  rm -rf "$clone"
  git_quiet clone --quiet "$remote" "$clone" 2>/dev/null
  (cd "$clone" && git_quiet fetch --quiet origin)
  echo "$clone"
}

advance_dev() { # advance_dev <remote> -> echoes the new full sha
  local remote="$1" bump="$WORK/bump"
  rm -rf "$bump"
  git_quiet clone --quiet --branch dev "$remote" "$bump" 2>/dev/null
  (
    cd "$bump"
    echo two >> file.txt
    git_quiet add file.txt
    git_quiet commit --quiet -m "two"
    git_quiet push --quiet origin HEAD:refs/heads/dev
    git rev-parse HEAD
  )
}

echo "deploy_git_sync"

# ---------------------------------------------------------------------------
# 1. The failure as it actually happened, which needs BOTH conditions at once.
#
#    A single-refspec fetch (`git fetch origin dev`) never tries to create
#    refs/remotes/origin/fix/*, so a stale parent ref alone does not break it.
#    What broke the box was the qualified ref: `git fetch origin origin/dev` asks
#    the remote for a branch that does not exist, fails, and falls through to the
#    full `git fetch origin` - and THAT is the fetch the stale parent ref kills.
#
#    Testing the two conditions separately is why the first version of this file
#    passed with --prune removed.
# ---------------------------------------------------------------------------
REMOTE="$(setup_remote)"
CLONE="$(setup_clone "$REMOTE")"
(
  cd "$WORK/seed"
  git_quiet push --quiet origin --delete fix
  git_quiet push --quiet origin HEAD:refs/heads/fix/passport-under-health
)
WANT="$(advance_dev "$REMOTE")"

# Preconditions, or the test proves nothing.
if git -C "$CLONE" show-ref --verify --quiet refs/remotes/origin/fix; then
  ok "precondition: clone holds the stale refs/remotes/origin/fix"
else
  no "precondition: clone holds the stale refs/remotes/origin/fix" "ref absent"
fi
if git -C "$CLONE" fetch origin >/dev/null 2>&1; then
  no "precondition: a plain fetch is broken by the stale ref" "plain fetch succeeded"
else
  ok "precondition: a plain fetch is broken by the stale ref"
fi

GOT="$(deploy_git_sync "$CLONE" origin/dev 2>/dev/null || echo SYNC_FAILED)"
check "recovers when the fallback fetch hits a stale parent ref" \
  "$(git -C "$CLONE" rev-parse --short "$WANT")" "$GOT"
check "checks out the requested commit, not whatever was there" \
  "$WANT" "$(git -C "$CLONE" rev-parse HEAD)"

# The dead parent must be GONE, not merely stepped around. A single-refspec
# fetch can succeed while leaving it in place, which leaves the checkout armed
# for the next caller that needs a full fetch.
if git -C "$CLONE" show-ref --verify --quiet refs/remotes/origin/fix; then
  no "clears the stale parent ref rather than working around it" "ref still present"
else
  ok "clears the stale parent ref rather than working around it"
fi
if git -C "$CLONE" fetch origin >/dev/null 2>&1; then
  ok "a plain fetch works again afterwards"
else
  no "a plain fetch works again afterwards" "still broken"
fi

# ---------------------------------------------------------------------------
# 2. The bare form resolves without asking the remote for a branch that cannot
#    exist. The qualified form still WORKS without the normalisation, because
#    the rev-parse fallback below covers it - what the normalisation buys is not
#    spending a doomed fetch first, so that is what is asserted.
# ---------------------------------------------------------------------------
REMOTE="$(setup_remote)"
CLONE="$(setup_clone "$REMOTE")"
WANT="$(advance_dev "$REMOTE")"

ERRS="$(deploy_git_sync "$CLONE" origin/dev 2>&1 >/dev/null || true)"
check "qualified form lands on the requested commit" \
  "$WANT" "$(git -C "$CLONE" rev-parse HEAD)"
if printf '%s' "$ERRS" | grep -q "couldn't find remote ref"; then
  no "qualified form does not ask the remote for 'origin/dev'" "$ERRS"
else
  ok "qualified form does not ask the remote for 'origin/dev'"
fi

REMOTE="$(setup_remote)"
CLONE="$(setup_clone "$REMOTE")"
WANT="$(advance_dev "$REMOTE")"
check "bare form lands on the same commit" \
  "$(git -C "$CLONE" rev-parse --short "$WANT")" \
  "$(deploy_git_sync "$CLONE" dev 2>/dev/null || echo SYNC_FAILED)"

# ---------------------------------------------------------------------------
# 3. An unresolvable ref must fail, not silently build whatever is checked out.
# ---------------------------------------------------------------------------
REMOTE="$(setup_remote)"
CLONE="$(setup_clone "$REMOTE")"
BEFORE="$(git -C "$CLONE" rev-parse HEAD)"

if deploy_git_sync "$CLONE" no-such-branch >/dev/null 2>&1; then
  no "fails on an unresolvable ref" "returned success"
else
  ok "fails on an unresolvable ref"
fi
check "leaves the checkout untouched when the ref cannot be resolved" \
  "$BEFORE" "$(git -C "$CLONE" rev-parse HEAD)"

echo
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
