# CI pipeline migration runbook

How to move from the current workflows to the `ci.yaml` pipeline, and how to get
back if it goes wrong.

## Where things stand

`ci.yaml` is live and runs on every pull request, on pushes to `main` and `dev`,
and on `merge_group`. It is **not** a required check, and it has **not** replaced
anything. These still run and are still the gates that matter:

- `ci-affected.yaml`
- `frontend-quality.yml`
- `frontend-a11y.yml`
- `dev-docs-build.yml`
- `sonar-cloud-analysis.yml`

So some work is duplicated on every pull request today. That is the cost of
being able to compare the two pipelines on real changes before switching.

The scan-only Sonar stage is off unless a run is dispatched with
`run_sonar: true`, because `sonar-cloud-analysis.yml` still analyses the same
SonarCloud projects and two analyses of one project in a single run would race.

### Verified before this landed

- Both rulesets, `3440858` (Main) and `3468092` (dev), have **zero** required
  status checks. Main gates on CodeQL `code_scanning`, PR review and copilot;
  dev on Sonar `code_quality`, PR review and copilot. Renaming or removing the
  current CI job names therefore blocks nothing, and this migration is additive.
- The base-SHA resolver is unit tested (`scripts/ci/compute-base-sha.bats`),
  including a regression test for the push-to-base-branch case that made pushes
  to `dev` report green having run nothing.
- The coverage merge was validated against two real sharded jest runs, with all
  four metrics preserved.

## Before switching anything over

1. Pick a pull request that touches the frontend and at least one other
   workspace. Compare, on the same commit:
   - wall-clock time and runner minutes, old pipeline vs `ci.yaml`;
   - the set of workspaces each one decided was affected;
   - frontend coverage from `_test` against the number
     `frontend-quality.yml` reports.
2. Dispatch `ci.yaml` with `run_sonar: true` on a branch and confirm, per app:
   - `lcov-check --resolve` passes and prints a sensible sample `SF:` path;
   - SonarCloud's `coverage`, `lines_to_cover` and `uncovered_lines` match what
     the current workflow reports for the same commit;
   - the scanner log contains no `Could not resolve` lines;
   - issue counts are compared, not assumed equal. Scan-only skips the app
     dependency install, so rules needing type resolution see less. The nightly
     full analysis is the backstop for that gap. Decide whether the delta is
     acceptable before relying on it.
3. Confirm the deliberately mis-normalised case still fails: corrupt an
   `SF:` prefix and check `_test` reds rather than publishing a 0% report.

## Switching over

Do these in order. Each step is separately revertible.

1. **Slim `frontend-quality.yml`.** Delete its `security-headers` and
   `type-check-and-test` jobs; keep the bundle and Lighthouse job consuming the
   `next-build` artifact instead of rebuilding. Before deleting
   `type-check-and-test`, confirm `_test` is enforcing the same coverage floor:
   it currently passes `statements=80,branches=70,functions=78,lines=80`, which
   is exactly what that job enforced on the jest command line. Confirm too that
   `securityHeaders.test.ts` and the jest-axe specs actually ran inside the
   frontend shards.
2. **Retire the old Sonar trigger.** Drop `pull_request` and `push` from
   `sonar-cloud-analysis.yml`, leaving `schedule` as the nightly baseline and
   type-aware backstop. In the same change, make `run_sonar` default to `true`
   in `ci.yaml`. These must move together, or the projects are scanned twice or
   not at all.
3. **Delete the superseded workflows:** `ci-affected.yaml`, `frontend-a11y.yml`,
   `dev-docs-build.yml`. `dev-docs` is covered because `_core`'s static job runs
   its `build`, whose `postbuild` copies the site into
   `apps/frontend/public/dev-docs`. Verify that output exists in a `_core` run
   before deleting.
4. **Make `CI Required` required.** Only after a `merge_group` event has
   produced a passing `CI Required`. For each ruleset:

   ```
   gh api repos/YosemiteCrew/Yosemite-Crew/rulesets/<id> > r.json
   jq '.rules += [{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":false,"do_not_enforce_on_create":false,"required_status_checks":[{"context":"CI Required"}]}}]' r.json > r.new.json
   gh api -X PUT repos/YosemiteCrew/Yosemite-Crew/rulesets/<id> --input r.new.json
   ```

   Re-GET both rulesets first and confirm nobody has added a required context
   referencing an old job name in the meantime.

5. **Enable the merge queue on `dev`,** only once step 4 is green. Check first
   whether a `code_quality` status posts on a `merge_group` ref. It is not
   expected to: SonarCloud decorates pull requests, not merge groups. If it does
   not, remove `code_quality` from dev's required set before enabling the queue,
   keeping it as PR decoration. `CI Required` carries the Sonar signal because
   `_sonar` runs with `-Dsonar.qualitygate.wait=true`.

`strict_required_status_checks_policy` stays `false` deliberately. Setting it
forces every pull request to rebase serially, which is the problem the merge
queue exists to solve.

## Reverting

**Order matters.** Remove the ruleset rule _before_ reverting the code, or every
pull request blocks on a required check that no longer exists.

1. Remove the `CI Required` rule from both rulesets (GET, drop the rule, PUT)
   and disable the merge queue.
2. Then `git revert -m 1 <merge commit>`.

If only one stage is misbehaving, prefer a narrower revert: setting `run_sonar`
back to `false` disables the scan-only path without touching the rest, and
restoring the old workflow files is enough to fall back without reverting the
tested base-SHA fix, which is worth keeping regardless.
