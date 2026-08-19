# The Sonar quality bar

Every Sonar leg in CI passes only when the analysed project meets all three of
these numbers:

| Measure                  | Limit  |
| ------------------------ | ------ |
| Coverage                 | >= 95% |
| Duplicated lines density | 0%     |
| Open issues (violations) | 0      |

The bar is enforced by `scripts/ci/sonar-thresholds.mjs`, which runs as the
final step of both Sonar pipelines:

- the `_sonar` stage of `ci.yaml` (pull requests and pushes to `main`),
- the nightly full analysis in `sonar-cloud-analysis.yml`.

Some runs never reach the stage, and the `CI Required` roll-up counts the skip
as a pass - these classes of change merge without the bar being evaluated:

- Dependabot pull requests (their secret store carries no Sonar tokens; the
  nightly re-scans every dependency change once it lands),
- pull requests from forks (same reason - forks never receive the secrets),
- runs whose test stage produced no app coverage (docs-only or CI-only
  changes touching no scannable app - though `.github/` and `scripts/ci/`
  changes widen the matrix to every workspace, so those ARE gated),
- anything while the `vars.DISABLE_SONAR` kill switch is set.

## Why the bar lives in the job, not on the server

SonarCloud evaluates a quality gate itself, and the `_sonar` stage's scan step
waits on it (`sonar.qualitygate.wait=true`; the nightly's scan does not wait,
so there the threshold step polls the compute engine itself before reading
measures). But this organisation's plan does not allow attaching a custom
quality gate - `api/qualitygates/select` answers 403 - so the only server-side
verdict available is the built-in "Sonar way" gate: 80% coverage and 3%
duplication on new code, and no condition on the issue count at all. Those are
not this repository's numbers, so the job reads the measures the analysis just
published and enforces the real bar itself.

## What the bar means on each analysis scope

The meaning of the three measures depends on what was analysed (verified
against live analyses):

- **Push to `main` and the nightly** analyse the main branch, and all three
  measures are whole-branch figures: the project as a whole must sit at 95%
  coverage, 0% duplication and zero open issues.
- **A pull request analysis** publishes whole-project `coverage` and
  `duplicated_lines_density` as of the PR head, while its `violations` counts
  the issues open on the pull request itself. A PR leg therefore enforces:
  the whole project meets the coverage and duplication bar, and the change
  introduces zero issues. The whole-branch zero-issues condition is carried by
  the push-to-`main` scan and the nightly.

Two failure modes are deliberately failures rather than passes:

- A measure the analysis never published (for example, `coverage` when the
  scanner resolved no coverage report) fails the check. Absence means the
  pipeline broke upstream, not that the project is clean.
- An analysis that published to a branch other than `main` fails the check.
  This organisation's plan serves only the main branch and pull requests;
  reading measures for any other branch silently returns `main`'s numbers, and
  a check that measures the wrong thing is worse than no check.

## When a leg is red

The step's log prints the three measures next to their limits and links the
SonarCloud dashboard for the analysis. To make it green:

- **Coverage below the floor**: add tests. On a PR, remember the published
  figure is the whole project's, so a PR can be red for debt it did not add -
  paying some of that debt down in the PR is the intended pressure.
- **Duplication above zero**: deduplicate, or - where the duplication is
  deliberate and justified - exclude it narrowly via `sonar.cpd.exclusions` in
  that app's `sonar-project.properties`, with a comment saying why.
- **Open issues**: fix them. For a finding that is agreed to be a false
  positive, record a narrow exclusion with its rationale in the app's
  `sonar-project.properties` rather than ignoring the leg.

The thresholds are passed on the command line in the two workflows, so a
deliberate change to the bar is a one-line, reviewable edit in each.

## Where the projects stood, and where they stand (2026-08-15)

The bar was written against the numbers on the left; three of the four projects
did not meet it. Each was remediated before this gate merged, so the gate lands
on a repository that already passes it and therefore blocks regressions rather
than reporting pre-existing debt.

| Project     | Coverage       | Duplication  | Open issues | Remediated by       |
| ----------- | -------------- | ------------ | ----------- | ------------------- |
| Desktop     | 96.3%          | 0.0%         | 0           | already met the bar |
| MobileAppYC | 98.1%          | 0.1% -> 0.0% | 3 -> 0      | #2196               |
| Frontend    | 97.5% -> 97.7% | 1.0% -> 0.0% | 4 -> 0      | #2210               |
| Backend     | 89.6% -> 96.5% | 1.3% -> 0.0% | 132 -> 0    | #2208               |

The right-hand figures come from each remediation PR's own SonarCloud analysis.
Note that the project dashboards lag behind them: this organisation's plan
analyzes only each project's main branch, and the remediation merged to `dev`,
so the dashboard figures refresh when `dev` is next promoted to `main`.

One finding was deliberately left open rather than papered over: the deprecated
Documenso `documents.createV0` call (#2207), whose replacement is not a
behavior-identical swap. It is excluded from no gate - the issue tracks the
migration, and until it lands the backend leg reflects it honestly.
