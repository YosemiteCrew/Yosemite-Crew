#!/usr/bin/env bash
# Waits for the Supply Chain run on one commit and exits with its result: 0 when
# it passed, 1 when it failed or did not finish in time.
#
# supply-chain.yml runs on the same tag push as the release workflows, in
# parallel with them. desktop-release.yml calls this before it makes a release
# public, and mobile-release.yml before its signed builds, so nothing ships
# from a commit whose Supply Chain run is red.
#
# Only push runs count (the tag push, or the merge to main the tag points at).
# The run a release workflow dispatches to attach SBOMs is not the verdict.
#
# Env: GH_TOKEN (actions: read), GITHUB_REPOSITORY, SHA.
# POLLS x INTERVAL seconds bounds the wait; the default is about 25 minutes.
set -euo pipefail

: "${SHA:?SHA is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
POLLS="${POLLS:-50}"
INTERVAL="${INTERVAL:-30}"

for ATTEMPT in $(seq 1 "$POLLS"); do
  # Several push runs can share a commit, so the most recent one decides.
  RUN=$(gh api \
    "repos/${GITHUB_REPOSITORY}/actions/workflows/supply-chain.yml/runs?head_sha=${SHA}&event=push&per_page=100" \
    --jq '.workflow_runs | sort_by(.created_at) | last | if . == null then "none" else "\(.status)|\(.conclusion)|\(.html_url)" end')
  if [ "$RUN" = "none" ]; then
    echo "[${ATTEMPT}/${POLLS}] No Supply Chain run found for ${SHA} yet; retrying in ${INTERVAL}s."
  else
    STATUS=${RUN%%|*}
    REST=${RUN#*|}
    CONCLUSION=${REST%%|*}
    URL=${REST#*|}
    if [ "$STATUS" = "completed" ]; then
      if [ "$CONCLUSION" = "success" ]; then
        echo "Supply Chain passed for ${SHA}: ${URL}"
        exit 0
      fi
      echo "::error::Supply Chain run for ${SHA} concluded '${CONCLUSION}' (${URL}); refusing to release."
      exit 1
    fi
    echo "[${ATTEMPT}/${POLLS}] Supply Chain run is ${STATUS} (${URL}); retrying in ${INTERVAL}s."
  fi
  sleep "$INTERVAL"
done
echo "::error::No completed Supply Chain run for ${SHA} after ${POLLS} checks; refusing to release."
exit 1
