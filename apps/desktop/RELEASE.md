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

## Update channels

Users choose their channel (Stable or Beta) in **Settings**. Updates are delivered automatically via `electron-updater`, reading published GitHub Releases.

`generateUpdatesFilesForAllChannels` is enabled, which makes channel behaviour intuitive and safe:

- A **stable** release also reaches users on the **beta** channel (a stable build is newer/better than the last beta).
- A **beta** release stays on the beta channel and is **never** pushed to stable-channel users.

## Cutting a release

1. Bump `version` in `apps/desktop/package.json`.
2. Commit with a conventional message, e.g. `chore(desktop): release v0.2.0`.
3. Create a tag that matches the version exactly: `desktop-v<version>` (e.g. `desktop-v0.2.0`).
4. Push the tag. The release workflow builds, signs, and publishes the installers to GitHub Releases.
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
produces the signed installers as CI build artifacts **without** creating a
public GitHub Release. Use this when the desktop app ships alongside other
products and the public release needs to be timed together.
