# Releasing

This describes how Yosemite Crew actually ships today. It intentionally does not introduce a new versioning scheme — it documents the one already in use across tags and GitHub Releases, and automates the one manual step (writing release notes) that Conventional Commits already make redundant.

## Branch model

- `dev` — integration branch. All PRs target `dev` (see [CONTRIBUTING.md](./CONTRIBUTING.md)).
- `main` — release-ready. Cut a release by fast-forwarding/merging `dev` into `main` once CI is green, then tagging on `main`.
- Hotfix: branch from `main`, fix, patch-tag directly (skip the `dev` queue for the fix itself), then back-merge `main` into `dev` so the fix isn't lost on the next release cut.

## Two release shapes

Different apps in this monorepo ship on different cadences to different targets, so they don't share one release mechanism:

| App | Mechanism | Trigger |
|---|---|---|
| `apps/frontend` (web) | Continuous deployment | Every push to `main`/`dev` that touches frontend paths ([`cd-frontend.yaml`](./.github/workflows/cd-frontend.yaml)) — no version tag involved. |
| `apps/backend` | Discrete tagged release | Manual: tag `backend-vX.Y.Z[-beta]`, then `gh release create`. **Not yet CI-automated.** |
| PMS (backend + frontend bundle) | Discrete tagged release | Manual: tag `pms-vX.Y.Z[-beta]`, then `gh release create`. **Not yet CI-automated.** |
| `apps/mobileAppYC` | Discrete tagged release | Manual: tag `mobile-vX.Y.Z-iOS-vA.B`, then `gh release create`. App-store submission is a separate manual step outside this repo. |
| `apps/desktop` | Discrete tagged release, CI-built | Tag `desktop-vX.Y.Z-beta` pushed → [`desktop-release.yml`](./.github/workflows/desktop-release.yml) builds and publishes the Windows installer automatically. |

Each component versions independently with SemVer plus a pre-release suffix (`-beta`, etc.) while still stabilizing. **Note:** `package.json` `version` fields (e.g. `apps/backend/package.json` currently reads `0.0.0`) are **not** kept in sync with release tags today — the tag is the source of truth for a component's version, not the `package.json`. Don't infer a release version from `package.json`.

## Release checklist

1. Confirm CI is green on `main` for the commit you're about to tag.
2. Pick the version per SemVer for that component (breaking change → major, new capability → minor, fix-only → patch), keeping the `-beta` suffix while the component is still pre-1.0-stable.
3. Tag with the correct component prefix, e.g. `git tag backend-v1.4.0-beta && git push origin backend-v1.4.0-beta`.
4. If a GitHub Release doesn't already exist for the tag, create one: `gh release create backend-v1.4.0-beta --title "backend v1.4.0-beta"`. The [release-notes workflow](#release-notes-are-generated-not-hand-written) below fills in the body automatically.
5. Smoke-test the deployed/published artifact.

## Release notes are generated, not hand-written

Commit messages are already enforced into `<type>(<scope>): <subject>` format by `commitlint` and the `pr-governance.yml` PR-title gate — every commit reaching `main` already carries the structure a changelog generator needs, so hand-writing release notes duplicates information the repo already has.

[`cliff.toml`](./cliff.toml) configures [git-cliff](https://git-cliff.org) to group commits by their Conventional Commit `type` (Features, Fixes, Performance, etc.). [`.github/workflows/release-notes.yml`](./.github/workflows/release-notes.yml) runs on every push of a `*-v*` tag: it finds the previous tag sharing the same component prefix, runs git-cliff over the commit range between them, and attaches the result to the GitHub Release via `gh release edit --notes-file` (creating the release first if the tag author hasn't already). Nothing is committed back to `main`/`dev` — the generated notes live on the GitHub Release itself, same place they've always lived, just no longer hand-typed.

If you want a preview before tagging, run it locally: `git-cliff <previous-tag>..HEAD --config cliff.toml`.

## What this does not (yet) do

- Backend/PMS/mobile releases are still manually tagged — this only automates the notes, not the decision of when/what to release or the artifact build/publish step.
- `package.json` versions are not wired to tags. Doing so would need per-app release automation (e.g. Changesets or release-please) with either per-PR changeset files or `package.json` as the real source of truth — a bigger change than "stop hand-writing notes," left for a future ADR if the team wants it.
