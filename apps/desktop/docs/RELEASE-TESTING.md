# Test Release Guide (Beta for Testers)

Current test version: **0.1.0-beta.1** (`apps/desktop/package.json`).

This produces installable builds for testers on **macOS** and **Windows**.
These test builds are **unsigned / not notarized** unless signing secrets are
configured — testers must do a one-time "open anyway" (see below).

---

## Recommended: build both platforms via GitHub Actions (hosted)

The `.github/workflows/desktop-release.yml` workflow builds macOS **and**
Windows on their native runners and uploads artifacts (+ the electron-updater
feed files) to a GitHub Release. This is the only reliable way to produce a
real Windows installer.

```sh
# from repo root, on a branch the workflow can see
git add -A && git commit -m "chore(repo): desktop 0.1.0-beta.1 test build"
git tag desktop-v0.1.0-beta.1
git push origin desktop-v0.1.0-beta.1
```

The workflow runs `lint → type-check → test → security:pressure`, then
`electron-builder --mac --win --publish always`, creating a **draft** GitHub
Release with:

- macOS: `Yosemite Crew PIMS-0.1.0-beta.1-mac-arm64.dmg` + `.zip`
- Windows: `Yosemite Crew PIMS-0.1.0-beta.1-win-x64-setup.exe` (NSIS) + portable `.exe`
- `latest-mac.yml` / `latest.yml` (auto-update feeds)

Review the draft Release, mark it **Pre-release**, and share the download links
with testers. Signing/notarization happen automatically **if** these repo
secrets are set (unset = unsigned build, still works for testers):
`MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
`APPLE_TEAM_ID`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`.

---

## Local: build the macOS installer now (for quick tester hand-off)

Double-click **`build-release-mac.command`** (in `apps/desktop/`), or:

```sh
pnpm --dir apps/desktop run desktop:dist:mac
```

Output in `apps/desktop/dist/`:

- `Yosemite Crew PIMS-0.1.0-beta.1-mac-arm64.dmg` ← share this
- `Yosemite Crew PIMS-0.1.0-beta.1-mac-arm64.zip`

> Windows cannot be reliably cross-built from macOS — use the GitHub Actions
> path above for the Windows installer.

---

## Tester install instructions

**macOS (unsigned beta):**

1. Open the `.dmg`, drag **Yosemite Crew PIMS** to Applications.
2. First launch: right-click the app → **Open** → **Open** (bypasses Gatekeeper
   for the unsigned beta). After that it opens normally.
3. Approve the keychain prompt(s) on first launch (cookie + audit-log encryption)
   — click **Always Allow**.

**Windows (unsigned beta):**

1. Run `Yosemite Crew PIMS-…-setup.exe` (or the portable `.exe`).
2. SmartScreen may warn → **More info** → **Run anyway**.
3. Choose install location; launch from Start Menu / desktop shortcut.

---

## What testers should verify

- Sign in; session persists across relaunch.
- Tabs: `Cmd/Ctrl+T` new tab, switch, close, reorder, reopen-closed, restore on relaunch.
- Command palette (`Cmd/Ctrl+K`): search + navigate + "New appointment".
- Menus: Compliance / Data / Tools actions open dialogs.
- Offline: pull network → cached pages still readable; reconnect recovers.
- Auto-update prompt (only on installed builds).

File feedback with: OS + version, steps, screenshot, and `Help → Export
Diagnostics` bundle if something breaks.

---

## Pre-release checklist

- [ ] `version` bumped (`0.1.0-beta.1`) and committed.
- [ ] Gate green: `pnpm --dir apps/desktop run type-check && lint && test && security:pressure`.
- [ ] App launches from a clean `dist/` build; welcome + sign-in + tabs work.
- [ ] Tag pushed (`desktop-v0.1.0-beta.1`) → Actions build succeeds → draft Release.
- [ ] Release marked **Pre-release**; install instructions shared with testers.
- [ ] (Optional) signing secrets configured to avoid the "open anyway" step.
