# Releasing the Yosemite Crew PIMS desktop app

This document describes how desktop releases are versioned, built, signed, and
delivered to users. It is intentionally free of any credentials — signing
secrets live only in CI secrets and a local, gitignored maintainer config and
are never committed.

## Versioning

The desktop app follows [Semantic Versioning](https://semver.org/):

- **Stable:** `MAJOR.MINOR.PATCH` (e.g. `0.2.0`) — published to the `latest` channel.
- **Pre-release:** `MAJOR.MINOR.PATCH-beta.N` (e.g. `0.2.0-beta.1`) — published to the `beta` channel.

Rules:

- Versions must always increase monotonically — the updater compares semver, so a version is never reused or lowered.
- The pre-release suffix alone decides the channel: a `-beta.N` build goes to `beta`; a clean `X.Y.Z` build goes to `latest`.
- Promote a beta to stable by dropping the `-beta.N` suffix and releasing the clean `X.Y.Z`.

## Release tags

Desktop release tags are plain `v<version>` (e.g. `v0.2.0`, `v0.1.0-beta.4`) — **not** the
`desktop-v*` prefix used by the other products in this monorepo. This is a hard
requirement of the updater, not a style choice:

- `electron-updater`'s GitHub provider extracts the tag from the release URL and skips
  any tag that is not valid semver. A `desktop-v0.1.0-beta.3` tag is invalid semver, so
  every such release is invisible to the updater and the check ends in
  `ERR_UPDATER_NO_PUBLISHED_VERSIONS`.
- `electron-builder` always publishes to `v<version>` taken from `package.json`,
  regardless of which tag triggered the build. If the pushed tag says something else,
  the installers land on a different release than the notes. The `verify` job in
  `.github/workflows/desktop-release.yml` fails the run when they disagree.
- The prefixes on `pims-*` and `backend-*` tags are what keep those releases from being
  mistaken for desktop builds: the updater skips them for the same semver reason.

## Update channels

Users choose their channel (Stable or Beta) in **Settings**. Updates are delivered automatically via `electron-updater`, reading published GitHub Releases.

- A **stable** release also reaches users on the **beta** channel (a stable build is newer/better than the last beta).
- A **beta** release stays on the beta channel and is **never** pushed to stable-channel users.

New installs default to the **beta** channel while the app ships only `-beta.N` builds,
and `initAutoUpdates` derives the channel from the running version when no preference is
stored. The stable channel resolves through GitHub's repo-wide "latest release", which in
this monorepo is usually another product — so a beta build left on the stable channel
finds a PIMS or backend tag with no `latest.yml` and fails. Flip the default in
`DEFAULT_SETTINGS` once a stable desktop release exists and holds that badge.

Note that `generateUpdatesFilesForAllChannels` does **not** apply here: `app-builder-lib`
short-circuits it for the `github` provider and only ever writes `latest.yml`. The beta
path falls back to `latest.yml` when `beta.yml` is absent, so no `beta.yml` is needed.

## Cutting a release

1. Bump `version` in `apps/desktop/package.json`.
2. Commit with a conventional message, e.g. `chore(desktop): release v0.2.0`.
3. Create a tag that matches the version exactly, with a `v` prefix: `v<version>` (e.g. `v0.2.0`).
4. Push the tag. The release workflow verifies the tag against the package version, creates the release, then builds, signs, and publishes the installers into it.
5. Clients on the matching channel pick up the update automatically and are prompted to restart to install.

## Code signing & notarization

Release builds are code-signed so users never see "unidentified developer" or "unknown publisher" warnings, and so auto-update works:

- **macOS** — signed with the organization's Apple Developer ID and notarized by Apple. Notarization is required for Gatekeeper and for Squirrel.Mac auto-update.
- **Windows** — the installer is signed via Azure Trusted Signing.

Signing only happens in CI (or, for maintainers, via the local gitignored config documented in `RELEASE-SIGNING.local.md`). Credentials are supplied through CI secrets and never appear in the repository.

## Local builds (testing only — not for distribution)

```sh
# Run the app unpackaged (fastest; picks up working-tree changes)
pnpm --filter desktop run desktop:dev

# Produce a packaged .app/installer locally without publishing
pnpm --filter desktop run desktop:pack
```

Local builds are for development and manual verification only. A locally built
app is **not** notarized/fully signed for distribution and will **not**
auto-update — only releases published through CI are distributable and
updatable.

## Coordinated / joint releases

The release workflow also supports a manual (`workflow_dispatch`) run that
produces signed installers as CI build artifacts and creates a **draft GitHub
Release** with the same files. This is the right path when you want downloadable
links without relying on the Actions artifact UI. If the repository is private,
the download page can still require GitHub authentication.
