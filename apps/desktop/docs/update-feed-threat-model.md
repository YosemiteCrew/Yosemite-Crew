# Update Feed Threat Model

This is the threat model for the desktop app's auto-update path (the GitHub Releases feeds that `electron-updater` reads to deliver new versions). It is for maintainers cutting or reviewing releases, and it lists the assets at risk, the threats against the update channel, the controls in place, and the checks every release must pass. For the signing and channel mechanics referenced below see [`../RELEASE.md`](../RELEASE.md); for the broader process and trust-boundary model see [`desktop-architecture.md`](desktop-architecture.md).

## Assets

- Installed Yosemite Crew PIMS desktop app.
- GitHub Release artifacts and `latest*.yml` update feeds.
- Signing identities for macOS Developer ID and Windows Authenticode.
- Clinic staff sessions and local app profile data.

## Threats

- Attacker publishes or swaps an update feed pointing to a malicious binary.
- Attacker compromises a beta channel and moves stable users to prerelease artifacts.
- Unsigned or incorrectly signed artifacts are accepted during manual testing and later become release process precedent.
- Feed metadata is served from an unexpected publisher/repository.
- A downgraded version is applied to reintroduce a known vulnerability.

## Current Controls

- Release feeds come from the configured GitHub repository.
- macOS production artifacts are expected to be Developer ID signed, hardened, notarized, stapled, and Gatekeeper accepted.
- Windows production artifacts are expected to be Authenticode signed.
- `latest-mac.yml` carries a `minimumSystemVersion` (a Darwin kernel version) stamped by `scripts/stamp-update-feed-min-os.js` in the release workflow, so electron-updater refuses a release the running macOS cannot launch. electron-builder writes `mac.minimumSystemVersion` into Info.plist only, never into the feed, so without this an Electron bump that raises the OS floor pushes an uninstallable build to every client below it.
- Update channel selection is layered: the default is derived from the running version (a `-beta.N` build defaults to `beta`; the app currently ships only beta builds, and electron-updater's prerelease path is a superset that also picks up stable releases), the stored settings preference can change it, and the `YC_DESKTOP_UPDATE_CHANNEL` env var - the managed/MDM control - is authoritative over both.
- Consequence for the beta-channel threat above: current installs follow the beta feed by default, so a compromised beta feed reaches the whole fleet rather than only opt-in testers - the signing, notarization, and release checks below are the controls that hold there, and a managed deployment can pin `YC_DESKTOP_UPDATE_CHANNEL=latest` to keep its fleet off prerelease artifacts regardless of local settings.

## Required Release Checks

- Verify macOS `.dmg` and `.zip` signatures with `codesign --verify --deep --strict --verbose=2`.
- Verify notarization with `spctl --assess --type open --verbose <dmg>` and staple status with `xcrun stapler validate`.
- Verify Windows NSIS and portable signatures with `Get-AuthenticodeSignature`.
- Verify `latest-mac.yml`, `latest.yml`, and beta feed files reference only artifacts from the same release and expected repository.
- Verify `latest-mac.yml` carries `minimumSystemVersion` matching `build.mac.minimumSystemVersion` translated to a Darwin version (macOS 13 -> `22.0.0`). The `publish` job enforces this against the draft's own asset before making the release public, so a lost or unstamped feed blocks the release rather than shipping.
- Verify updates never downgrade unless a documented rollback release is signed and approved.

## Follow-Up Evaluation

- Add publisher fingerprint checks before update installation if `electron-updater` hooks expose the resolved artifact metadata early enough.
- Keep beta feed permissions separate from stable publishing credentials where GitHub process allows it.
- Add an auto-update E2E fixture that hosts local `latest` and `beta` feeds and validates `0.1.0 -> 0.1.1` without hitting GitHub.
