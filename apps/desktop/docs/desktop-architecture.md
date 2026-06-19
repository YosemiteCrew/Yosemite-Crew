# Desktop Architecture

## Process Model

The desktop app is an Electron shell around the Yosemite Crew PIMS web app. The main process owns native app lifecycle, navigation policy, update checks, crash reporting, local status pages, window state, deep links, tray/idle-lock wiring, offline cache, sync status, and local desktop data controls. Renderer code should be treated as web content and should only reach native capabilities through the preload bridge and validated IPC channels.

## Navigation Boundary

PIMS pages should load only from configured Yosemite Crew origins. Developer portal and unknown external origins should open in the system browser. Local welcome/loading/offline pages are file-backed desktop assets, so they need a narrow protocol and file privilege posture that does not generalize to arbitrary renderer file access.

## IPC Boundary

IPC channels should be allowlisted in `src/ipc.ts` and exposed through `src/preload.ts`. Renderer input should be validated before it affects navigation, native dialogs, filesystem paths, update checks, or process lifecycle. No channel should accept unstructured objects that are later forwarded directly into Electron APIs.

## Runtime Hardening

Electron fuses should disable legacy or unused runtime features while preserving the explicitly needed local file page behavior. Context isolation, sandboxing where compatible, restricted permissions, and a tight content security policy should remain part of every local page.

## Updates

`src/updater.ts` supports `latest` by default and `beta` when `YC_DESKTOP_UPDATE_CHANNEL=beta`. Production releases publish electron-updater feed files through GitHub Releases. Manual update checks should provide user-visible feedback; background checks should stay quiet except for download-ready prompts.

## Telehealth

Desktop telehealth is GetStream-only. The desktop process does not create Stream calls or tokens; it validates a PIMS-provided launch intent and opens the trusted appointments telehealth route with `provider=getstream`, `appointmentId`, and/or `callId`. PIMS/backend remain responsible for Stream Video call creation, membership, token issuance, and the in-app call UI.

## Sync

The desktop owns local sync status and manual sync triggers, but the real backend contract is external. Without `YC_DESKTOP_SYNC_URL`, dirty local rows and queued mutations are reported as blocked. When an endpoint is configured, `yc:sync-now` runs the existing sync engine and reports per-table results through validated IPC.

## Threat Model

Primary risks are credential phishing via unexpected navigation, renderer-to-main IPC abuse, unsafe local file privileges, malicious update feeds, and sensitive clinic data leakage through logs or telemetry. Mitigations are origin allowlists, IPC validation, signed/notarized release artifacts, no-PII telemetry, crash upload opt-in, and keeping local desktop pages static and narrowly privileged.
