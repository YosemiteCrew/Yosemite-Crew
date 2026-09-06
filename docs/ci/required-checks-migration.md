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
- `CI Required` - one aggregate check. **Required on `dev` since 2026-09-06.**

## What was removed, and where it went

| Removed                                                                | Absorbed by                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ci-affected.yaml`                                                     | `ci.yaml` (`_core` detect + `_test`)                                                                                     |
| `frontend-a11y.yml`                                                    | `_test` shards run the jest-axe specs; they are ordinary `*.test.tsx` files the default suite already collects           |
| `dev-docs-build.yml`                                                   | `_core` static runs `pnpm --filter dev-docs build`, whose postbuild copies the site into `apps/frontend/public/dev-docs` |
| `frontend-quality.yml` type-check / lint / unit / security-header jobs | `_core` (lint, type-check) and `_test` (jest with the same coverage floor; `securityHeaders.test.ts` runs in the shards) |
| `sonar-cloud-analysis.yml` per-PR and per-push analysis                | `_sonar`; that workflow is now schedule-only, kept as the nightly drift baseline and type-aware backstop                 |

## Outstanding (post-merge, require repo-admin and a human)

Verified draft-day: rulesets `3440858` (Main) and `3468092` (dev) had **zero**
required status checks, so nothing removed above was ever a required check and
none of it blocked merges.

**Re-measured 2026-09-06. Step 1 is DONE and its instructions are removed
below.** Leaving the paragraph above in the present tense outlived the change it
described, and a reader using it to judge whether a missing `CI Required` row
matters would have drawn the opposite conclusion - on `dev` an absent row blocks
the merge. Read off the rulesets, not off this file:

| ruleset    | name                                              | required status checks                 |
| ---------- | ------------------------------------------------- | -------------------------------------- |
| `3468092`  | dev                                               | `CI Required`, `Supply Chain Required` |
| `3440858`  | Main                                              | `Only dev may merge into main`         |
| `21048611` | Protect main and dev from deletion and force-push | none                                   |

**There are three rulesets, not two.** And `Only dev may merge into main` is a
status check _context_ whose text reads exactly like a rule description, so any
listing that prints contexts in a column gives a reader no way to tell which it
is. `CI Required` is not among Main's required checks; `code_quality` is
required on none of the three.

~~1. Make `CI Required` required.~~ **Done.** The instructions that stood here
appended a `required_status_checks` rule to a ruleset - re-GET, `jq '.rules +=
[...]'`, `PUT`. Running them now would append a _second_ such rule to a ruleset
that already has one. That is why they are deleted rather than struck: this
section is imperative, and a stale imperative is worse than a stale description
because a reader can execute it. The precondition it assumed is exactly what
this document now records as false.

The one instruction worth keeping from it, because it is the check that would
have caught this: **re-GET the rulesets and confirm nobody has added a required
context referencing an old job name** before changing any of them.

One step remains, and its gate is now satisfied - it was blocked on step 1 and
is not any more:

1. **Enable the merge queue on `dev`.** No ruleset carries a `merge_queue` rule
   today. Check whether
   a `code_quality` status posts on a `merge_group` ref. It is not expected to -
   SonarCloud decorates pull requests, not merge groups. If it does not, remove
   `code_quality` from dev's required set before enabling the queue, keeping it
   as PR decoration. (Measured 2026-09-06: `code_quality` is not in dev's
   required set, so that removal may already be moot - re-check rather than
   assume either way.) The Sonar signal for queued changes is the PR run's sonar
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
