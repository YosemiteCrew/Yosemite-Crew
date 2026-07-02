<p align="center">
  <a href="https://yosemitecrew.com/">
    <img src="https://d2il6osz49gpup.cloudfront.net/YC.svg" width="150px" alt="Yosemite Crew Logo" />
  </a>
</p>

<h1 align="center">Yosemite Crew Mobile App</h1>

<div align="center">

[![React Native 0.81.4](https://img.shields.io/badge/React%20Native-0.81.4-61DAFB?logo=react)](https://reactnative.dev)
[![PNPM](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Contributing](https://img.shields.io/badge/Contribute-FF9800)](https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_MobileAppYC&metric=coverage)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_MobileAppYC)

</div>

<div align="center">
This directory contains the React Native mobile application for the **Yosemite Crew** open-source operating system for animal health. This app serves as the primary interface for pet parents to connect with veterinary service providers and manage their companion's health.
</div>

## 📲 Store Links

<div align="center"><a href="https://play.google.com/store/apps/details?id=com.mobileappyc&pcampaignid=web_share"><img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" width="200" alt="Get it on Google Play" align="middle" /></a>&nbsp;<a href="https://apps.apple.com/in/app/yosemite-crew/id6756180296"><img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" width="155" alt="Download on the App Store" align="middle" /></a></div>

## 📦 Release Versioning

Current production releases:

| Platform | Store Version | Build |
| -------- | ------------- | ----- |
| Android  | v1.0.10       | 12    |
| iOS      | v1.2          | 12    |

Release history:

| Platform | Version | Notes                                                                                                                                                                                                    |
| -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android  | v1.0.10 | Map-based vet business discovery with full-screen interactive map; appointment packages during booking; unified clinical packet (SOAP, prescriptions, discharge); bug fixes and performance improvements |
| iOS      | v1.2    | Map-based vet business discovery with full-screen interactive map; appointment packages during booking; unified clinical packet (SOAP, prescriptions, discharge); bug fixes and performance improvements |
| Android  | v1.0.6  | Tasks module GA (calendar sync, observational tools); liquid glass UI polish; appointment consent e-signing                                                                                              |
| iOS      | v1.0.3  | Tasks module GA (calendar sync, observational tools); liquid glass UI polish; appointment consent e-signing                                                                                              |
| Android  | v1.0.5  | Initial production release                                                                                                                                                                               |
| iOS      | v1.0.2  | Initial production release                                                                                                                                                                               |

## 🛠️ Getting Started

This guide will walk you through setting up the mobile app on your local machine for development.

### Prerequisites

- **Node.js**: Version `20` or higher.
- **pnpm**: Ensure you have `pnpm` installed globally.
- **React Native Environment**: You **must** complete the official setup guide for your OS and target platform (Android/iOS). Follow the instructions under the "**React Native CLI Quickstart**" tab.
  - [**React Native Environment Setup Guide**](https://reactnative.dev/docs/set-up-your-environment)
- **Ruby and Bundler**: Required for managing iOS dependencies (CocoaPods).
- **AWS Account & IAM User**: An active AWS account is required to run the backend.

---

### Reference Development Environment

The mobile app is known to build on the following local setup. Contributors do not need the exact same machine, but matching the major tooling versions below is the safest starting point when debugging native iOS or Android build failures.

#### macOS / shell

| Tool   | Version / value                 |
| ------ | ------------------------------- |
| macOS  | `26.4.1`                        |
| CPU    | Apple Silicon `arm64`, Apple M4 |
| Memory | `16 GB`                         |
| Shell  | `zsh 5.9` at `/bin/zsh`         |

#### JavaScript / package tooling

| Tool                        | Version / value                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Node.js                     | `24.7.0`                                                                            |
| Node path                   | `/opt/homebrew/bin/node`                                                            |
| npm                         | `11.5.1` at `/opt/homebrew/bin/npm`                                                 |
| pnpm                        | `8.15.6`                                                                            |
| Yarn                        | Not installed / not used                                                            |
| nvm                         | `0.40.3` installed; active React Native CLI shell uses the Homebrew Node path above |
| React                       | `19.1.0`                                                                            |
| React Native                | `0.81.4`                                                                            |
| React Native CLI            | `@react-native-community/cli 20.0.0`                                                |
| Global React Native package | Not installed                                                                       |

Use `pnpm` for this repository. Prefer `pnpm exec react-native ...` over `npx react-native ...` when matching the repo-local CLI exactly.

#### iOS tooling

| Tool                 | Version / value                                                              |
| -------------------- | ---------------------------------------------------------------------------- |
| Xcode                | `26.0`                                                                       |
| Xcode build          | `17A324`                                                                     |
| xcodebuild path      | `/usr/bin/xcodebuild`                                                        |
| iOS SDK              | `26.0`                                                                       |
| Other Apple SDKs     | DriverKit `25.0`, macOS `26.0`, tvOS `26.0`, visionOS `26.0`, watchOS `26.0` |
| CocoaPods            | `1.16.2`                                                                     |
| CocoaPods path       | `/Users/harshitwandhare/.rbenv/shims/pod`                                    |
| Ruby                 | `3.3.9` at `/Users/harshitwandhare/.rbenv/shims/ruby`                        |
| RubyGems             | `3.5.22`                                                                     |
| Bundler              | `2.5.22`                                                                     |
| Relevant gems        | `cocoapods 1.16.2`, `xcodeproj 1.27.0`, `activesupport 7.2.2.2`              |
| iOS Hermes           | Enabled                                                                      |
| iOS New Architecture | Enabled                                                                      |

If an iOS build works on this setup but fails on a newer Xcode, first compare `xcodebuild -version` and the installed iOS SDK. For example, `Xcode 26.5` with `iOS SDK 26.5` may surface newer native compiler warnings than `Xcode 26.0`.

#### Android tooling

| Tool                     | Version / value                              |
| ------------------------ | -------------------------------------------- | ----------------------- |
| Java                     | `17.0.16`                                    |
| JRE/JDK                  | OpenJDK Zulu `17.0.16+8-LTS`                 |
| javac path               | `/usr/bin/javac`                             |
| Android Studio           | `2025.1 AI-251.26094.121.2512.13930704`      |
| Android SDK path         | `/Users/harshitwandhare/Library/Android/sdk` |
| Android SDK API levels   | `35`, `36`                                   |
| Android SDK Build Tools  | `35.0.0`                                     |
| Android emulator         | `36.1.9.0`                                   |
| adb                      | `1.0.41`, platform-tools `36.0.0-13206524`   |
| Android system image     | `android-35                                  | Google Play ARM 64 v8a` |
| Android NDK              | Not installed                                |
| Android Hermes           | Enabled                                      |
| Android New Architecture | Enabled                                      |
| Gradle wrapper           | `8.14.3`                                     |

#### Other native tooling

| Tool     | Version / value                                 |
| -------- | ----------------------------------------------- |
| Watchman | `2025.09.01.00` at `/opt/homebrew/bin/watchman` |

To compare a contributor machine against this setup, run:

```sh
pnpm exec react-native info
node -v
pnpm -v
ruby -v
gem -v
bundle -v
pod --version
xcodebuild -version
java -version
javac -version
watchman --version
```

---

### Step 1: Configure Your AWS Credentials

Before you begin, the AWS Amplify CLI needs credentials to deploy resources to your AWS account.

1.  **Create an IAM User**: In your AWS account, create a new IAM user with **AdministratorAccess**.
2.  **Get Access Keys**: Generate an **Access Key ID** and a **Secret Access Key**.
3.  **Configure Your Local Machine**: Configure the AWS CLI on your machine by running `aws configure` and providing the keys you generated. The Amplify CLI uses these credentials automatically.

```sh
# Install the AWS CLI if you haven't already
# Then, configure it with your IAM user credentials
aws configure
AWS Access Key ID [None]: YOUR_ACCESS_KEY_ID
AWS Secret Access Key [None]: YOUR_SECRET_ACCESS_KEY
Default region name [None]: us-east-1
Default output format [None]: json
```

---

### Step 2: Install Monorepo Dependencies

Navigate to the **root** of the entire `Yosemite-Crew` monorepo (not this folder) and install all project dependencies using `pnpm`.

```sh
# From the root of the Yosemite-Crew project
pnpm install
```

---

### Step 3: Set up AWS Amplify Sandbox

This project uses AWS Amplify for its backend. Run a local sandbox environment that connects to your configured AWS account.

1.  **Start the sandbox**. This will deploy a development backend to your AWS account.

    ```sh
    npx ampx sandbox
    ```

2.  **Set the required secrets**. You must have a **verified sender identity in Amazon SES** (Simple Email Service) for passwordless OTP emails to work.

    ```sh
    # Replace YOUR_VERIFIED_EMAIL@example.com with your verified SES email address
    npx ampx sandbox secret set PASSWORDLESS_OTP_EMAIL_FROM YOUR_VERIFIED_EMAIL@example.com

    # This secret is optional if you are not mocking a custom user service
    npx ampx sandbox secret set CUSTOM_USER_SERVICE_URL
    ```

3.  **Grant Email Permissions in AWS IAM**. The Cognito IAM role generated by the sandbox needs permission to send emails through SES.
    - Navigate to the **IAM console** in your AWS account.
    - Find the unauthenticated IAM role associated with your Cognito Identity Pool (its name will be similar to `amplify-....-unauth-role`).
    - Attach a new inline policy with the following JSON.

    <!-- end list -->

    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": ["ses:SendEmail", "ses:SendRawEmail"],
          "Resource": "arn:aws:ses:YOUR_AWS_REGION:YOUR_AWS_ACCOUNT_ID:identity/YOUR_VERIFIED_EMAIL@example.com"
        }
      ]
    }
    ```

    > **Important**: Replace the placeholder `Resource` ARN with the actual ARN of your verified SES identity.

---

### Step 4: Configure Environment Credentials (Crucial\!)

Several config files are gitignored because they contain keys. We provide example/template files for every one of them. Run the commands below from the **root of the monorepo** unless noted otherwise.

> **A Note on Environment Variables**: We do not use `react-native-config` due to instability with React Native's New Architecture (Fabric). Configuration is done directly in the native project files and a gitignored JS file as described below.

---

#### Quick-start checklist

Copy and tick off each item before trying to build:

- [ ] **A. Amplify / Cognito** — `devamplify_outputs.json` (+ `prodamplify_outputs.json` if testing prod auth)
- [ ] **B. JS variables** — `variables.local.ts`
- [ ] **C. Android: Firebase** — `google-services.json`
- [ ] **D. Android: Native keys** — `strings.xml` + `gradle.properties` + `local.properties`
- [ ] **E. iOS: Firebase** — `GoogleService-Info.plist`
- [ ] **F. iOS: Native keys** — `Info.plist` + `Secrets.xcconfig` + `.xcode.env.local` (if needed)

All committed setup templates live under `apps/mobileAppYC/config-templates/`. Files copied out of that folder into `android/`, `ios/`, or the app root are local-only unless this README explicitly says otherwise.

#### Local file inventory

Create these gitignored files when setting up a fresh clone:

| Local file                                                     | Template / source                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/mobileAppYC/devamplify_outputs.json`                     | `config-templates/amplify/amplify_outputs.example.json` or your Amplify sandbox output |
| `apps/mobileAppYC/prodamplify_outputs.json`                    | `config-templates/amplify/amplify_outputs.example.json` or production Amplify output   |
| `apps/mobileAppYC/src/config/variables.local.ts`               | `config-templates/env/variables.local.example.ts`                                      |
| `apps/mobileAppYC/android/app/google-services.json`            | `config-templates/android/google-services.example.json` or Firebase Console            |
| `apps/mobileAppYC/android/app/src/main/res/values/strings.xml` | `config-templates/android/strings.example.xml`                                         |
| `apps/mobileAppYC/android/gradle.properties`                   | `config-templates/android/gradle.properties.example`                                   |
| `apps/mobileAppYC/android/local.properties`                    | `config-templates/android/local.properties.example` or Android Studio                  |
| `apps/mobileAppYC/ios/GoogleService-Info.plist`                | `config-templates/ios/GoogleService-Info.example.plist` or Firebase Console            |
| `apps/mobileAppYC/ios/mobileAppYC/Info.plist`                  | `config-templates/ios/Info.plist.example`                                              |
| `apps/mobileAppYC/ios/mobileAppYC/Secrets.xcconfig`            | `config-templates/ios/Secrets.xcconfig.example`                                        |
| `apps/mobileAppYC/ios/.xcode.env.local`                        | create manually only if Xcode cannot find Node                                         |

Leave these tracked project files committed and do not replace them with local secret copies:

| Tracked file                                                | Purpose                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/mobileAppYC/firebase.json`                            | React Native Firebase build/runtime defaults               |
| `apps/mobileAppYC/ios/.xcode.env`                           | Shared Xcode Node lookup fallback                          |
| `apps/mobileAppYC/ios/mobileAppYC/Config.debug.xcconfig`    | Debug build includes for optional local secrets and Pods   |
| `apps/mobileAppYC/ios/mobileAppYC/Config.release.xcconfig`  | Release build includes for optional local secrets and Pods |
| `apps/mobileAppYC/ios/mobileAppYC/mobileAppYC.entitlements` | iOS app capabilities/entitlements                          |

The template `config-templates/env/.env.example` is informational only. This app does not load `.env` files.

---

#### A. Amplify / Cognito (`devamplify_outputs.json` / `prodamplify_outputs.json`)

The app uses AWS Amplify for authentication. It automatically selects the correct Cognito pool at startup based on `USE_DEV_API` in `variables.local.ts` — **no manual file swapping needed**.

- `USE_DEV_API = true` → configures Amplify with `devamplify_outputs.json` → authenticates against the **dev Cognito pool** → hits `devapi.yosemitecrew.com`
- `USE_DEV_API = false` → configures Amplify with `prodamplify_outputs.json` → authenticates against the **prod Cognito pool** → hits `api.yosemitecrew.com`

Both files are gitignored and must be created locally. The app imports both files during JS bundling, so both must exist and contain valid JSON even if you only use the dev API. The Cognito pool and API must always match — mixing them causes 401s on every request.

**Option 1 — Use the shared contributor dev pool (no AWS account needed, recommended for UI work):**

```sh
cp apps/mobileAppYC/config-templates/amplify/amplify_outputs.example.json \
   apps/mobileAppYC/devamplify_outputs.json
cp apps/mobileAppYC/config-templates/amplify/amplify_outputs.example.json \
   apps/mobileAppYC/prodamplify_outputs.json
```

This connects you to the shared development Cognito pool (`eu-central-1_2jEniI2eQ`). Log in with any email address via OTP, or use the review-login bypass (`test@yosemitecrew.com`) when `enableReviewLogin` is active on the dev API. This is a shared dev environment — do not store sensitive data in it.

> For normal development, keep `USE_DEV_API = true`. The `prodamplify_outputs.json` file can be the same stub as `devamplify_outputs.json`; it just needs to be present and valid so Metro/Hermes can compile the bundle.

**Option 2 — Spin up your own isolated sandbox (requires AWS account):**

Follow Step 3 above to run `npx ampx sandbox`. Copy the generated `amplify_outputs.json` to `devamplify_outputs.json`. No further changes needed.

---

#### B. JavaScript Variables (`variables.local.ts`)

This file controls which backend environment the app points to and holds optional API keys for JavaScript/API services (Stream Chat, Stripe, Google Places web services, PostHog). It is gitignored and never committed.

Create it from the committed template:

```sh
cp apps/mobileAppYC/config-templates/env/variables.local.example.ts \
   apps/mobileAppYC/src/config/variables.local.ts
```

Open the copied file and read the top section. The only required change for development is the **master environment switch** at the top:

```ts
// true  → dev Cognito pool + devapi.yosemitecrew.com
// false → prod Cognito pool + api.yosemitecrew.com
const USE_DEV_API = true;
```

Setting `USE_DEV_API = true` does two things automatically:

1. Routes all API calls to `devapi.yosemitecrew.com`
2. Loads `devamplify_outputs.json` so the Cognito pool matches the backend

Everything else in the file has sensible defaults and inline comments explaining each option.

`GOOGLE_PLACES_CONFIG.apiKey` is used by the React Native JavaScript Google Places service. It is separate from the native Google Maps SDK keys used by Android and iOS map rendering.

PostHog mobile analytics are disabled by default. If you want to enable them for a non-production build, configure `POSTHOG_CONFIG` with a project API key and host, and only switch `enabled` or `defaultOptIn` on after your privacy/consent flow is ready.

> The `variables.ts` file (committed) contains safe defaults and type definitions. Your `variables.local.ts` is layered on top at runtime automatically.

---

#### C. Android: Firebase (`google-services.json`)

Required for push notifications (FCM). The app boots and runs without real values — you will just not receive push notifications.

**If you have access to the Firebase project:** download `google-services.json` from Firebase Console → Project Settings → Android app → download button, then place it at `apps/mobileAppYC/android/app/google-services.json`.

**If you do not have Firebase access** (UI development only):

```sh
cp apps/mobileAppYC/config-templates/android/google-services.example.json \
   apps/mobileAppYC/android/app/google-services.json
```

The stub file has the correct structure. Firebase init will log a warning on startup and push notifications will not work, but the rest of the app is fully functional.

---

#### D. Android: Native Keys (`strings.xml` + `gradle.properties` + `local.properties`)

These files are local machine/project configuration and are intentionally gitignored. Keep them out of commits; use the example files below as the source of truth.

1. **Facebook SDK keys**:

   ```sh
   cp apps/mobileAppYC/config-templates/android/strings.example.xml \
      apps/mobileAppYC/android/app/src/main/res/values/strings.xml
   ```

   Open the file and replace `YOUR_FACEBOOK_APP_ID` and `YOUR_FACEBOOK_CLIENT_TOKEN` with real values. Facebook login will not work with placeholders, but the app still builds and runs.

2. **Gradle properties** (build settings + release signing):

   ```sh
   cp apps/mobileAppYC/config-templates/android/gradle.properties.example \
      apps/mobileAppYC/android/gradle.properties
   ```

   For debug builds no further changes are needed. Release/bundle builds require filling in the four keystore fields at the bottom of the file (`YC_RELEASE_STORE_FILE`, `YC_RELEASE_STORE_PASSWORD`, `YC_RELEASE_KEY_ALIAS`, `YC_RELEASE_KEY_PASSWORD`).

3. **Android SDK path + Google Maps SDK key** (`local.properties`):
   ```sh
   cp apps/mobileAppYC/config-templates/android/local.properties.example \
      apps/mobileAppYC/android/local.properties
   ```
   Open the file and set `sdk.dir` to your local Android SDK path. If you open the project in Android Studio it may generate this file automatically; still add `MAPS_API_KEY` afterward if you need Google Maps rendering.
   ```
   # macOS example:
   sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
   MAPS_API_KEY=YOUR_ANDROID_GOOGLE_MAPS_API_KEY
   ```

---

#### E. iOS: Firebase (`GoogleService-Info.plist`)

Required for push notifications (APNs via FCM). Same story as Android — the app boots without real values.

**If you have access to the Firebase project:** download `GoogleService-Info.plist` from Firebase Console → Project Settings → iOS app, place it at `apps/mobileAppYC/ios/GoogleService-Info.plist`, and **add it to the Xcode project** (drag into Xcode, tick "Copy items if needed").

**If you do not have Firebase access** (UI development only):

```sh
cp apps/mobileAppYC/config-templates/ios/GoogleService-Info.example.plist \
   apps/mobileAppYC/ios/GoogleService-Info.plist
```

Then add this stub file to the Xcode project the same way. Push notifications will not work; everything else will.

---

#### F. iOS: Native Keys (`Info.plist` + `Secrets.xcconfig` + `.xcode.env.local`)

`AppDelegate.swift` is application source code and must stay tracked. Do not place API keys or service tokens in `AppDelegate.swift`; put iOS native keys in the gitignored `Info.plist`, `GoogleService-Info.plist`, or `Secrets.xcconfig` files created below.

1. **Info.plist** — contains Facebook SDK keys, Google Sign-In reverse client ID, a `GMSApiKey` placeholder, and permission usage strings:

   ```sh
   cp apps/mobileAppYC/config-templates/ios/Info.plist.example \
      apps/mobileAppYC/ios/mobileAppYC/Info.plist
   ```

   Open the file and replace:

   | Placeholder                  | Where to find it                                                |
   | ---------------------------- | --------------------------------------------------------------- |
   | `YOUR_FACEBOOK_APP_ID`       | Facebook Developer Console → your app → App ID                  |
   | `YOUR_FACEBOOK_CLIENT_TOKEN` | Facebook Developer Console → Settings → Advanced → Client Token |
   | `YOUR_REVERSED_CLIENT_ID`    | `ios/GoogleService-Info.plist` → `REVERSED_CLIENT_ID` value     |

   Keep both location purpose keys from the template (`NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription`) even if a library triggers the always-location API indirectly; App Store validation requires the purpose string to be present.

   Facebook and Google Sign-In social auth will not work with placeholders, but OTP login and everything else in the app will function normally.

2. **Secrets.xcconfig** — contains the iOS Google Maps SDK key consumed by `Info.plist` as `$(GOOGLE_MAPS_API_KEY)`:

   ```sh
   cp apps/mobileAppYC/config-templates/ios/Secrets.xcconfig.example \
      apps/mobileAppYC/ios/mobileAppYC/Secrets.xcconfig
   ```

   Open the file and replace `YOUR_IOS_GOOGLE_MAPS_API_KEY`. Google Maps rendering will not work with the placeholder.

3. **`.xcode.env.local`** — tells Xcode's build scripts where Node.js is on your machine. Required for Xcode builds (the Metro bundler script phase uses it). Create it manually:
   ```sh
   echo "export NODE_BINARY=$(command -v node)" > apps/mobileAppYC/ios/.xcode.env.local
   ```
   If you use nvm or fnm, replace `$(command -v node)` with the full path to your Node binary (e.g. `~/.nvm/versions/node/v20.x.x/bin/node`). The committed `ios/.xcode.env` already has a fallback — `.xcode.env.local` only needs to be created if your Xcode builds fail with "node: command not found".

---

### Step 5: Update Application Identifiers

For a clean build, change the default package name (Android) and bundle identifier (iOS).

- **Android**: In `android/app/build.gradle`, change the `applicationId` from `"com.mobileappyc"` to your own. Also, refactor the directory structure under `android/app/src/main/java/` to match.
- **iOS**: In Xcode, open `apps/mobileAppYC/ios/mobileAppYC.xcworkspace`, go to the "General" tab, and change the **Bundle Identifier**.

---

### Step 6: Run The Application

All commands below should be run from this directory (`apps/mobileAppYC`).

#### 1\. Start the Metro Server

Open a terminal and keep it running.

```sh
# Using pnpm
pnpm start
```

#### 2\. Build for Android or iOS

Open a **new** terminal window.

##### ▶️ Android

```sh
pnpm run android
```

##### ▶️ iOS

```sh
# Navigate to the iOS directory to install pods
cd ios
bundle install
bundle exec pod install
cd ..

# Run the app
pnpm run ios
```

If everything is set up correctly, you should see the app running. ✨

---

## 🐛 Troubleshooting

If you encounter any issues, please refer to the official documentation first:

- [React Native Troubleshooting Guide](https://reactnative.dev/docs/troubleshooting)

## ⚠️ Known Issues

The following are known bugs that are expected to be resolved in future releases of React Native or related library dependencies.

- **Issue 1053: iOS/Android Build Issue with Library Compatibility**
  - Link: [https://github.com/YosemiteCrew/Yosemite-Crew/issues/1053](https://github.com/YosemiteCrew/Yosemite-Crew/issues/1053)

---

## 🙌 Contributing

We love contributions\! Please read our [**Contributing Guide**](https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md) to get started.
