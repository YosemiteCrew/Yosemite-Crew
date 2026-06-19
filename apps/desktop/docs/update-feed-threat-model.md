# Update Feed Threat Model

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
- Update channel selection is explicit: default `latest`, beta only with `YC_DESKTOP_UPDATE_CHANNEL=beta`.

## Required Release Checks

- Verify macOS `.dmg` and `.zip` signatures with `codesign --verify --deep --strict --verbose=2`.
- Verify notarization with `spctl --assess --type open --verbose <dmg>` and staple status with `xcrun stapler validate`.
- Verify Windows NSIS and portable signatures with `Get-AuthenticodeSignature`.
- Verify `latest-mac.yml`, `latest.yml`, and beta feed files reference only artifacts from the same release and expected repository.
- Verify updates never downgrade unless a documented rollback release is signed and approved.

## Follow-Up Evaluation

- Add publisher fingerprint checks before update installation if `electron-updater` hooks expose the resolved artifact metadata early enough.
- Keep beta feed permissions separate from stable publishing credentials where GitHub process allows it.
- Add an auto-update E2E fixture that hosts local `latest` and `beta` feeds and validates `0.1.0 -> 0.1.1` without hitting GitHub.
