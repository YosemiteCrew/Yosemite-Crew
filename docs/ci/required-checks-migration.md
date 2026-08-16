# CI pipeline: what runs, and the remaining switchover

The single-run `ci.yaml` pipeline is the primary CI. This records what it
replaced, the two steps that are still outstanding, and how to roll back.

## What ci.yaml does

One Actions run, stages as reusable workflows passing artifacts and outputs
directly:

- `_core` - resolve the affected set (tested, fail-closed base-SHA resolver),
  build shared packages once (`dist-packages`) and the frontend once
  (`next-build`), run lint / type-check / app builds off those artifacts.
- `_test` - each affected suite once, sharded; per-shard istanbul coverage
  merged per app; per-app floor on the merged report (frontend 80/70/78/80,
  desktop 95/88/95/95, backend and mobile a measured-something tripwire).
- `_sonar` - scan only, reading the coverage `_test` produced. No install, no
  Prisma, no jest. Kill switch: set the `DISABLE_SONAR` repo variable to `true`.
- `frontend-quality` - bundle budgets and Lighthouse, consuming `next-build`.
- `CI Required` - one aggregate check. **Not yet a required status check.**

## What was removed, and where it went

| Removed                                                                | Absorbed by                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ci-affected.yaml`                                                     | `ci.yaml` (`_core` detect + `_test`)                                                                                     |
| `frontend-a11y.yml`                                                    | `_test` shards run the jest-axe specs; they are ordinary `*.test.tsx` files the default suite already collects           |
| `dev-docs-build.yml`                                                   | `_core` static runs `pnpm --filter dev-docs build`, whose postbuild copies the site into `apps/frontend/public/dev-docs` |
| `frontend-quality.yml` type-check / lint / unit / security-header jobs | `_core` (lint, type-check) and `_test` (jest with the same coverage floor; `securityHeaders.test.ts` runs in the shards) |
| `sonar-cloud-analysis.yml` per-PR and per-push analysis                | `_sonar`; that workflow is now schedule-only, kept as the nightly drift baseline and type-aware backstop                 |

## Outstanding (post-merge, require repo-admin and a human)

Verified draft-day: rulesets `3440858` (Main) and `3468092` (dev) have **zero**
required status checks. Main gates on CodeQL `code_scanning` + PR review +
copilot; dev on Sonar `code_quality` + PR review + copilot. So nothing that was
removed above was ever a required check, and none of this blocked merges.

Two steps remain, both needing a green `merge_group` run first:

1. **Make `CI Required` required.** Re-GET both rulesets, confirm nobody added a
   required context referencing an old job name, then append the rule:

   ```
   gh api repos/YosemiteCrew/Yosemite-Crew/rulesets/<id> > r.json
   jq '.rules += [{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":false,"do_not_enforce_on_create":false,"required_status_checks":[{"context":"CI Required"}]}}]' r.json > r.new.json
   gh api -X PUT repos/YosemiteCrew/Yosemite-Crew/rulesets/<id> --input r.new.json
   ```

2. **Enable the merge queue on `dev`,** only once step 1 is green. Check whether
   a `code_quality` status posts on a `merge_group` ref. It is not expected to -
   SonarCloud decorates pull requests, not merge groups. If it does not, remove
   `code_quality` from dev's required set before enabling the queue, keeping it
   as PR decoration. The Sonar signal for queued changes is the PR run's sonar
   stage (which runs `-Dsonar.qualitygate.wait=true`, so a red gate reds the
   PR's `CI Required` before the PR can enter the queue): the `merge_group` run
   itself SKIPS sonar deliberately, because the SonarCloud plan only analyzes
   each project's main branch and a queue's ephemeral ref can never publish -
   the same reason dev pushes skip it. A queue run therefore re-verifies build
   and tests, not Sonar; for most PRs the gate was already enforced at the PR
   head. Three PR classes skip the PR-run scan and enter the queue with NO
   Sonar verdict - Dependabot PRs (their secret store has no Sonar tokens),
   fork PRs (same reason), and everything while the `DISABLE_SONAR` kill
   switch is set - so their Sonar signal arrives only after merge, from the
   push-to-main scan and the nightly. Weigh that residual gap before removing
   `code_quality` from the required set.

`strict_required_status_checks_policy` stays `false` deliberately: setting it
forces every PR to rebase serially, which is the problem the queue solves.

## Before relying on _sonar as the gate

On a branch, confirm per app that `lcov-check --resolve` passes with a sensible
sample `SF:` path, that SonarCloud's `coverage` / `lines_to_cover` /
`uncovered_lines` match the previous workflow on the same commit, that the
scanner log has no `Could not resolve`, and that issue counts are compared (not
assumed equal): scan-only skips the app dependency install, so rules needing
type resolution see less, and the nightly full run is the backstop for that gap.

## Rollback

**Order matters.** Remove the ruleset rule _before_ reverting code, or every PR
blocks on a required check that no longer exists.

1. Remove the `CI Required` rule from both rulesets (GET, drop the rule, PUT)
   and disable the merge queue. (Only if step 1/2 above were done.)
2. Then `git revert -m 1 <merge commit>`.

Narrower options without a full revert: set the `DISABLE_SONAR` repo variable to
`true` to drop just the scan-only stage; the deleted workflows can be restored
from git history without touching the tested base-SHA fix, which is worth
keeping regardless.
