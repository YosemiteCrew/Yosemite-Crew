# Developer Portal Tier 2 - Fork + Self-Host via a Yosemite GitHub App

**Status:** Proposed - design for ratification
**Epic:** #1582 (developer portal)
**Audience:** Core contributors and advanced developers who need to change core code. Tier 1 (config engine + AI editor, no fork) remains the default path and is covered by the [Developer Data API contract](./developer-portal-data-api.md), [ADR 0005](../adr/0005-ai-editing-agent-security-model.md) (agent security model), and the [website builder plan](./developer-portal-website-builder.md).
**Related:** ADR 0003 / PR #1763 (provider-neutral auth, unmerged as of 2026-07-07), `RELEASING.md` + git-cliff release notes, root `docker-compose.yml` and self-hosting docs.

---

## Goal

Give a developer who has outgrown Tier 1 a one-click way to get their own copy of the Yosemite Crew codebase, wired into the developer portal so we know which version they started from and can tell them when upstream ships something they should care about. The mechanism is a GitHub App registered under the YosemiteCrew org, as named in epic #1582.

Tier 2 is deliberately narrow. It is for people who need to change core code - not a growth channel. Keeping the surface small avoids fork sprawl and keeps the ecosystem's center of gravity on Tier 1 config and plugins.

## Non-goals

- **Hosting forks for anyone.** Developers self-host their copy (docker-compose, or their own infra following the self-hosting docs). We never run their code.
- **Auto-merging upstream into forks.** No conflict resolution, no "sync" button. See "Version skew" below.
- **Replacing Tier 1.** If a need can be met with Forms/Templates/ObservationTool/FHIR mapping config, it belongs in Tier 1.

## Why a template repository, not a git fork

"Create my PIMS fork" is implemented with GitHub's template-repository pattern (`POST /repos/{owner}/{template}/generate`), not a literal `git fork`:

- **Clean divergence semantics.** A GitHub fork lives in the upstream fork network: PRs default back to upstream, and a fork of a public repo cannot be made private. A repo generated from a template is fully owned by the developer, can be private, and carries no implied contribute-back relationship.
- **Cleaner licensing/provenance.** The generated repo starts from a single squashed initial commit. Provenance is explicit - a pinned upstream version recorded in the repo and in the portal - rather than implied by shared git history.
- **Smaller starting point.** No multi-year history to clone, and the template can be pre-seeded with self-host scaffolding that the main repo does not want in its root.

The template repo is maintained under the YosemiteCrew org and refreshed from upstream on each release tag. It ships with:

- `.env.example` covering the required env surface (database, `AUTH_PROVIDER` config per ADR 0003 - SuperTokens managed cloud by default, self-hosters can point at their own core, Stripe keys optional).
- `docker-compose.yml` for local/self-hosted bring-up.
- A pinned upstream version marker (e.g. `.yosemite-upstream-version` containing the release tag) that the upgrade notifier reads and humans can eyeball.

## What the GitHub App does in v1

Four things, nothing else.

### 1. "Create my PIMS fork" from the developer portal

Flow: developer clicks the button in the portal -> redirected to install the Yosemite GitHub App on their account or org (choosing which repos to grant) -> the portal uses the user-to-server token from the App's OAuth handshake to generate a new repo from the template into the developer's account -> developer lands on their new repo.

Repo creation requires a user-to-server token (installation tokens cannot create repos in a personal account); everything after creation - issues, optional upgrade PRs - uses short-lived installation tokens scoped to that one repo.

### 2. Portal record of developer <-> repo

A new Prisma model in `packages/database` (name at implementation time, e.g. `DeveloperSelfHostRepo`):

| Field                 | Purpose                                 |
| --------------------- | --------------------------------------- |
| `developerId`         | Portal identity (SuperTokens user id)   |
| `installationId`      | GitHub App installation id              |
| `repoFullName`        | `owner/name` of the generated repo      |
| `upstreamVersion`     | Release tag the repo was generated from |
| `lastNotifiedVersion` | Last release we opened an issue/PR for  |

The portal uses this to show "your PIMS is on v1.4.0, upstream is v1.6.0" and upgrade status. Prisma Migrate remains the source of truth for the schema, as everywhere else.

### 3. Upgrade notifications

The App is also installed on the upstream repo, so the backend receives `release.published` webhooks. On each release it iterates the linked repos and opens an **issue** in each developer repo containing the git-cliff release notes for the span between their `upstreamVersion` and the new tag, plus any migration notes called out per `RELEASING.md`. If applying the upstream diff to the developer's default branch is clean (no conflicts, developer has not touched the affected paths), the App may open a **PR** instead - but v1 can ship issue-only and add the PR path later; see permissions below.

### 4. Nothing else - permissions are minimal and enumerated

| Permission      | Level | Why                                                                           |
| --------------- | ----- | ----------------------------------------------------------------------------- |
| `contents`      | write | Push the version marker on creation; branch for the optional clean-upgrade PR |
| `metadata`      | read  | Mandatory for all GitHub Apps                                                 |
| `issues`        | write | Upgrade notification issues                                                   |
| `pull_requests` | write | **Only if** the clean-upgrade PR path ships in v1; omit for issue-only v1.0   |

No `administration`, no `workflows`, no `secrets`, no org-level permissions. Any permission addition is a design change requiring review, and GitHub will re-prompt every installer - treat that as a feature.

## What it does NOT do in v1

- No CI for forks (no workflow files pushed, no checks reported).
- No secrets management - developers manage their own `.env` per the template's `.env.example`.
- No hosted deploys or "deploy my fork" button.
- No auto-upgrade PRs with conflict resolution. A conflicted upgrade gets an issue with release notes, and the developer merges by hand.

### Lifecycle events

The webhook handler also listens for `installation.deleted` and `installation_repositories.removed`: when a developer uninstalls the App or revokes the repo, the portal marks the `DeveloperSelfHostRepo` row inactive and stops notifying. Repo deletion on GitHub surfaces the same way (installation token calls start failing 404); handle it by deactivating, not erroring.

## Eligibility: keeping Tier 2 narrow

Tier 2 is not shown to every portal user. Gate the entry point behind an explicit flag on the developer account (set manually by a maintainer for core contributors and vetted integrators, in the spirit of the epic's "core contributors only" scoping). This is a product gate, not a security boundary - the code is public and anyone can clone it - but the gate keeps the supported, notified, portal-linked path scoped to people we have capacity to support, and keeps casual users on Tier 1 where upgrades are our problem instead of theirs.

## Identity linking

GitHub sign-in (Phase 0, SuperTokens ThirdParty with GitHub as a provider) is a prerequisite: the portal must already know the developer's GitHub identity before Tier 2 is offered. App installation is a separate, explicit step - signing in with GitHub grants us nothing on the developer's repos, and installing the App is where the developer consciously grants the enumerated permissions above. Do not conflate the two flows or reuse the sign-in OAuth token for repo operations.

## Registration and operations

The GitHub App must be registered under the YosemiteCrew org by a human (a maintainer). Registration produces the app id, client id, client secret, webhook secret, and a private key; these are supplied to the backend as env vars (e.g. `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`). Values live in deployment secrets, never in the repo.

Portal code is env-driven and inert until configured: when the env vars are absent, the "Create my PIMS fork" entry point does not render and the webhook route 404s. This lets the code merge and sit dormant until the App is registered, and lets self-hosters of the portal itself register their own App if they want the feature.

## Version skew: the honest promise

Forks WILL diverge. A developer who changes core code owns that divergence, and no tooling in this plan changes that. The promise of Tier 2 is:

1. You always know which upstream version you started from (portal + version marker).
2. You are told when upstream ships a release, with real release notes and migration notes in your own repo's issue tracker.
3. The docs (`RELEASING.md`, self-hosting guide) tell you how to upgrade by hand.

That is notification + documentation, not compatibility magic. Anything stronger (contract tests against forks, guaranteed-clean upgrade paths) is out of scope and probably impossible.

## Acceptance criteria for v1

- A flagged developer can go from portal button to a working repo in their own account, generated from the template at the latest release tag, in one sitting.
- The portal shows the linked repo and its pinned upstream version.
- Publishing a release tag upstream results in an issue (with git-cliff notes) in every active linked repo, exactly once per release per repo.
- With the GitHub App env vars unset, the portal builds, runs, and shows no Tier 2 surface.
- The App's requested permissions match the table above exactly - nothing extra.

## Open questions for the reviewer

1. **Marketplace listing or org-internal?** Publishing the App on the GitHub Marketplace increases discoverability but adds GitHub review requirements and support expectations. An unlisted App installed via a portal deep link may be enough for the intended core-contributor audience.
2. **Full monorepo template vs slimmed template?** Templating the whole pnpm+turbo monorepo is simplest to maintain (refresh = copy at tag) but hands developers apps they may not want (mobile, desktop, dev-docs). A slimmed template (backend + frontend + packages) is friendlier but is a second artifact to keep honest. Proposal: full monorepo for v1, revisit if it deters adoption.
3. **License note.** Repos generated from a template are copies of the codebase; the repo's license terms follow them, and how the license interacts with private copies and self-hosted modifications should be confirmed by the maintainer (flagging only - this document does not give legal advice). Whatever the answer, the template README should state it plainly so developers are not surprised.
