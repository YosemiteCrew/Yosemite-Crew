# Mobile App Store Submission Process

Reference guide for submitting Yosemite Crew to the Apple App Store and Google Play Store.

---

## Pre-Submission Checklist

Run these steps **before every new submission** (or after a rejection). Do not bump versions mid-review.

### 1. Set Production Config — `src/config/variables.local.ts`

Both flags must be `false` for a store build:

```ts
const USE_DEV_API = false;
// ↑ routes all API traffic to api.yosemitecrew.com (production)

export const UI_FEATURE_FLAGS = {
  forceLiquidGlassBorder: false,
  // ↑ disables debug border on liquid glass surfaces
};
```

Also confirm `MOBILE_CONFIG_BEHAVIOR.overrides.forceLiquidGlassBorder` is `false`.

---

### 2. Silence Console Output — `App.tsx`

The following block must be **uncommented** (not wrapped in `//`) for production builds (lines 203–207):

```ts
const noop = () => {};
console.log = noop;
console.info = noop;
console.debug = noop;
console.trace = noop;
```

---

### 3. Bump Versions

> **Only bump for a new submission or after a rejection.** Do not bump while under review.

#### Android — `android/app/build.gradle`

```groovy
defaultConfig {
    versionCode 13          // increment by 1 each submission (current: 12)
    versionName "1.0.11"    // update to the new public version (current: 1.0.10)
}
```

#### iOS — Xcode project settings (`mobileAppYC.xcodeproj`)

Update both values in the **General** tab of the `mobileAppYC` target, or directly in `project.pbxproj`:

| Field                   | Key in pbxproj            | Current |
| ----------------------- | ------------------------- | ------- |
| Version (Marketing)     | `MARKETING_VERSION`       | 1.0.4   |
| Build (Project version) | `CURRENT_PROJECT_VERSION` | 8       |

Increment `CURRENT_PROJECT_VERSION` by 1 for every archive. Increment `MARKETING_VERSION` only when the user-facing version string changes.

---

## Android Build

### Keystore

`my-release-key.keystore` must be present at `android/app/my-release-key.keystore`.

`android/gradle.properties` must contain:

```properties
YC_RELEASE_STORE_FILE
YC_RELEASE_STORE_PASSWORD
YC_RELEASE_KEY_ALIAS
YC_RELEASE_KEY_PASSWORD
```

### Clean

Run from `apps/mobileAppYC/android/`:

```bash
rm -rf app/build
rm -rf build
rm -rf .cxx
rm -rf .gradle
./gradlew clean
```

### Build APK (testing / sideload)

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Build AAB (Play Store)

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## iOS Build

### Clean

Run from `apps/mobileAppYC/ios/`:

```bash
rm -rf Pods
rm -rf build
rm Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

### Reinstall Pods

```bash
pod deintegrate
pod install
```

### Archive in Xcode

1. Open `ios/mobileAppYC.xcworkspace` (not `.xcodeproj`).
2. Select **any physical iOS device** (or "Any iOS Device (arm64)") as the target — not a Simulator.
3. **Product → Clean Build Folder** (`⇧⌘K`).
4. **Product → Archive**.
5. When prompted, enter your **laptop password** to sign the build.

### Distribute

After the archive completes, Xcode opens the Organizer:

1. Select the new archive and click **Distribute App**.
2. Upload to **both**:
   - **Preflight** — validates the binary before App Store Connect receives it.
   - **App Store Connect** — the actual submission upload.
3. Wait for the "Upload Successful" confirmation before closing Xcode.

---

## Store Submission

### Google Play Console

1. Open [Google Play Console](https://play.google.com/console).
2. Select the **Yosemite Crew** app.
3. Navigate to **Testing → (current open track)** and confirm the AAB passes internal testing.
4. Navigate to **Release → Production → Create new release**.
5. Upload `app-release.aab`.
6. Update the **Release name** to match `versionName` (e.g. `1.0.11`).
7. Fill in release notes, then **Review release** and **Roll out to production**.

### Apple App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com).
2. The uploaded build appears under **TestFlight** within ~15 minutes.
3. Create a new App Store version if needed and attach the build.
4. Fill in **What's New**, screenshots (if changed), and any reviewer notes.
5. Submit for review.

---

## Post-Approval — Update README

After both stores approve and the release goes live, update `README.md`:

### Current production releases table

```md
| Platform | Store Version | Build |
| -------- | ------------- | ----- |
| Android  | vX.X.X        | XX    |
| iOS      | vX.X          |       |
```

### Release history table

Add a new row at the top of the history table for **each platform** with:

- Platform
- Version string
- Detailed description of what shipped (features, bug fixes, performance improvements)

Example format:

```md
| Android | v1.0.11 | <feature summary — appointment scheduling improvements; bug fixes> |
| iOS | v1.0.5 | <feature summary — appointment scheduling improvements; bug fixes> |
```

---

## Version Reference

| Platform | File                              | Field                     | Current value |
| -------- | --------------------------------- | ------------------------- | ------------- |
| Android  | `android/app/build.gradle`        | `versionCode`             | 12            |
| Android  | `android/app/build.gradle`        | `versionName`             | `"1.0.10"`    |
| iOS      | `mobileAppYC.xcodeproj` (pbxproj) | `MARKETING_VERSION`       | `1.0.4`       |
| iOS      | `mobileAppYC.xcodeproj` (pbxproj) | `CURRENT_PROJECT_VERSION` | `8`           |

---

## Common Pitfalls

- Opening `.xcodeproj` instead of `.xcworkspace` — Pods will not be linked.
- Forgetting to run `pod install` after cleaning — build will fail with missing headers.
- `USE_DEV_API = true` left on — app hits dev backend in production.
- Submitting to Play Store with an AAB signed by the wrong keystore — upload is rejected.
- Bumping the version number mid-review — Apple treats it as a new binary and restarts review.
