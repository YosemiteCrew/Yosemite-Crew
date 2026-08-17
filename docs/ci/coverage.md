# Coverage gates in CI

Two coverage gates run in the test workflow, and they measure different things.

## The aggregate floor (every run)

After the sharded test legs finish, `scripts/ci/merge-coverage.mjs` merges each
app's shard reports into one istanbul map and enforces that app's floor from the
`COVERAGE_FLOORS` map in `.github/workflows/_test.yaml`. This is a whole-app
figure: the statements, branches, functions and lines of the entire app must sit
above the configured numbers.

An aggregate floor is the right tool for holding a project at a level, but it
cannot see a single change. A well-covered app can absorb a block of untested
lines without dipping under its floor - the project was already far enough above
the bar that the new gap does not drag the total under it. The floor stays green
while the debt lands.

## The diff-coverage gate (pull requests only)

`scripts/ci/diff-coverage.mjs` closes that gap. It runs only on pull requests,
after the merge step, and measures the coverage of the executable lines the
branch ADDS rather than the app as a whole.

### What it measures

- **Added lines.** The step runs `git diff <base>...HEAD` - a three-dot diff
  against the pull request's merge base, so only the lines this branch
  introduced relative to where it forked are in scope, not unrelated commits the
  base has moved on to. The parser records the new-file line numbers each hunk
  adds.
- **Executable lines only.** Each added line is looked up in the merged istanbul
  map. A line the map records is measured, and counts as covered when its hit
  count is above zero. A line the map does not record - a comment, a blank line,
  or a file istanbul never instrumented such as a doc or a config - is not
  executable, is not measured, and does not count against the floor.
- **New files fail honestly.** A brand-new source file with no test is still
  instrumented, because the gated apps collect coverage from uncovered files, so
  every one of its added lines shows up in the map at zero hits and the gate
  fails as it should. A docs-only or comment-only change adds nothing
  measurable and passes.

The pass condition is `covered / measured >= floor`. When a change adds no
executable lines at all, there is nothing to gate and the step passes.

### Which apps are gated, and why

The per-app floors live in `DIFF_COVERAGE_FLOORS`, beside `COVERAGE_FLOORS`.
Only `frontend` and `desktop` are listed, both at 90. Those two enforce a real
aggregate coverage floor and both collect coverage from uncovered files, so a
newly added untested line reliably appears in the map at zero hits for this gate
to catch.

`backend` and `mobile` carry only a `lines=1` tripwire in `COVERAGE_FLOORS`, not
a real coverage bar, so they get no diff floor either: an app the aggregate gate
does not hold to a number is not one this gate second-guesses. An app absent
from `DIFF_COVERAGE_FLOORS` is skipped with a log line, not failed.

### Fail-closed behaviour

Like `merge-coverage.mjs` and `lcov-check.mjs`, the gate refuses to pass on the
absence of data. A missing, empty, or unparseable map, or a map that records no
files, fails the step rather than reporting a clean run over nothing - an absent
map means the pipeline broke upstream, not that the change is covered. A bad
`--floor` value fails the same way.

## Running it locally

The gate is a plain Node script with no CI-only inputs, so it runs against a
patch and a merged map on disk:

```bash
# Coverage map: merge your app's coverage report(s) the same way CI does, or
# reuse an existing apps/<app>/coverage/coverage-final.json from a coverage run.
git diff origin/dev...HEAD > /tmp/diff.patch

node scripts/ci/diff-coverage.mjs \
  --diff /tmp/diff.patch \
  --map apps/frontend/coverage/coverage-final.json \
  --root "$(git rev-parse --show-toplevel)" \
  --floor 90
```

The script prints the covered/measured tally, the resulting percentage against
the floor, and a compact line range of any uncovered added lines per file. It
exits non-zero when the added-line coverage falls below the floor.

The pure functions - `parseUnifiedDiff`, `evaluateDiffCoverage`, `formatRanges`

- and the fail-closed exit codes are covered by
  `scripts/ci/diff-coverage.test.mjs`, which runs under `pnpm run test:scripts`.
