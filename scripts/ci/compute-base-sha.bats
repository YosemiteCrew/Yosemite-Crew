#!/usr/bin/env bats
# Unit tests for compute-base-sha.sh.
#
# Each test runs against a throwaway git repo so the commit-existence checks
# exercise real git plumbing rather than a stub.

setup() {
  SCRIPT="$BATS_TEST_DIRNAME/compute-base-sha.sh"
  REPO="$(mktemp -d)"
  cd "$REPO"
  git init --quiet
  git config user.email ci@example.com
  git config user.name CI

  git commit --quiet --allow-empty -m first
  FIRST="$(git rev-parse HEAD)"
  git commit --quiet --allow-empty -m second
  SECOND="$(git rev-parse HEAD)"
  git commit --quiet --allow-empty -m third
  HEAD_SHA="$(git rev-parse HEAD)"

  ZERO='0000000000000000000000000000000000000000'
  # A well-formed SHA that is not an object in this repo.
  ABSENT='dead00000000000000000000000000000000beef'

  unset GITHUB_EVENT_NAME EVENT_BEFORE PR_BASE_SHA MERGE_GROUP_BASE_SHA FORCE_PUSH_BASE
}

teardown() {
  rm -rf "$REPO"
}

@test "pull_request uses the PR base sha" {
  GITHUB_EVENT_NAME=pull_request PR_BASE_SHA="$FIRST" run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"sha=$FIRST"* ]]
  [[ "$output" == *'run_all=false'* ]]
}

@test "push uses event.before, not a merge-base against its own branch" {
  # Regression test for the false-green bug: on a push to dev the old workflow
  # computed `git merge-base origin/dev HEAD`, which is HEAD, so nothing was
  # ever detected as affected and CI passed having run no jobs.
  GITHUB_EVENT_NAME=push EVENT_BEFORE="$SECOND" run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"sha=$SECOND"* ]]
  [[ "$output" != *"sha=$HEAD_SHA"* ]]
  [[ "$output" == *'run_all=false'* ]]
}

@test "push with the zero sha falls back to HEAD~1" {
  GITHUB_EVENT_NAME=push EVENT_BEFORE="$ZERO" run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"sha=$SECOND"* ]]
  [[ "$output" == *'run_all=false'* ]]
}

@test "push with a base missing from the checkout falls back to HEAD~1" {
  GITHUB_EVENT_NAME=push EVENT_BEFORE="$ABSENT" run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"sha=$SECOND"* ]]
  [[ "$output" == *'run_all=false'* ]]
}

@test "merge_group uses the merge group base sha" {
  GITHUB_EVENT_NAME=merge_group MERGE_GROUP_BASE_SHA="$FIRST" run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"sha=$FIRST"* ]]
  [[ "$output" == *'run_all=false'* ]]
}

@test "force_push_base overrides the event-derived base" {
  GITHUB_EVENT_NAME=push EVENT_BEFORE="$SECOND" FORCE_PUSH_BASE="$FIRST" run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"sha=$FIRST"* ]]
}

@test "an unusable force_push_base runs everything rather than guessing" {
  GITHUB_EVENT_NAME=push EVENT_BEFORE="$SECOND" FORCE_PUSH_BASE="$ABSENT" run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *'sha='* ]]
  [[ "$output" == *'run_all=true'* ]]
}

@test "an unknown event with no base runs everything" {
  GITHUB_EVENT_NAME=workflow_dispatch run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *'run_all=false'* ]]
  # workflow_dispatch has no event base, so it lands on the HEAD~1 fallback.
  [[ "$output" == *"sha=$SECOND"* ]]
}

@test "a root commit with no parent runs everything" {
  ROOT="$(mktemp -d)"
  cd "$ROOT"
  git init --quiet
  git config user.email ci@example.com
  git config user.name CI
  git commit --quiet --allow-empty -m only

  GITHUB_EVENT_NAME=push EVENT_BEFORE="$ZERO" run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *'run_all=true'* ]]
  rm -rf "$ROOT"
}

@test "the resolved base is never HEAD" {
  # A base equal to HEAD is the empty-diff failure mode this script exists to
  # prevent, so assert it across every event shape.
  for event in pull_request push merge_group workflow_dispatch; do
    GITHUB_EVENT_NAME="$event" run bash "$SCRIPT"
    [ "$status" -eq 0 ]
    [[ "$output" != *"sha=$HEAD_SHA"* ]]
  done
}
