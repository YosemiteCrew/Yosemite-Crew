# Mobile App Update Backend Guide (iOS + Android)

## Objective

Provide a production-grade remote app update policy through the existing mobile config endpoint so the React Native app can:

1. Force-block outdated app versions/builds
2. Show optional update prompts with cooldown
3. Handle iOS and Android policy independently

This must be backward-compatible with existing mobile config consumers.

## Existing Endpoint (Keep)

Current mobile app reads:

```http
GET /v1/mobile-config/
```

Current client base URL:

- Production: `https://api.yosemitecrew.com/v1/mobile-config/`

Do not break existing keys (`env`, `enablePayments`, `stripePublishableKey`, etc.).

## New Response Contract

Add `appUpdate` in response payload.

```ts
type MobileConfigResponse = {
  env: 'dev' | 'development' | 'staging' | 'prod' | 'production';
  enablePayments: boolean;
  stripePublishableKey?: string;
  sentryDsn?: string;
  forceLiquidGlassBorder?: boolean | string;
  appUpdate?: {
    // Global fallback policy (legacy-compatible)
    enabled?: boolean | string;
    force?: boolean | string;
    title?: string;
    message?: string;
    minimumSupportedVersion?: string; // e.g. "1.0.6"
    minimumSupportedBuildNumber?: number | string; // e.g. 8
    latestVersion?: string; // e.g. "1.1.0"
    latestBuildNumber?: number | string; // e.g. 12
    remindAfterHours?: number | string; // default client fallback: 24
    iosStoreUrl?: string;
    androidStoreUrl?: string;
    storeUrl?: string;
    appStoreId?: string; // iOS fallback if url missing

    // Platform-specific policy (preferred)
    ios?: {
      enabled?: boolean | string;
      force?: boolean | string;
      title?: string;
      message?: string;
      minimumSupportedVersion?: string;
      minimumSupportedBuildNumber?: number | string;
      latestVersion?: string;
      latestBuildNumber?: number | string;
      remindAfterHours?: number | string;
      storeUrl?: string;
      appStoreId?: string;
    };
    android?: {
      enabled?: boolean | string;
      force?: boolean | string;
      title?: string;
      message?: string;
      minimumSupportedVersion?: string;
      minimumSupportedBuildNumber?: number | string;
      latestVersion?: string;
      latestBuildNumber?: number | string;
      remindAfterHours?: number | string;
      storeUrl?: string;
    };
  };
};
```

## Client Evaluation Rules (Important)

The mobile app currently evaluates policy as follows:

1. Select platform policy first:
   - iOS: `appUpdate.ios`
   - Android: `appUpdate.android`
2. Missing platform fields fall back to global `appUpdate.*`
3. `required` update if any true:
   - `force === true`
   - current version `< minimumSupportedVersion`
   - current build number `< minimumSupportedBuildNumber`
4. `optional` update if:
   - `enabled === true`
   - current version/build is below `latestVersion/latestBuildNumber`
5. If neither rule matches: no prompt
6. Optional prompt cooldown:
   - Uses `remindAfterHours` (default 24 if missing/invalid)

## Store URL Resolution Rules

### iOS

Order used by app:

1. `appUpdate.ios.storeUrl`
2. `appUpdate.iosStoreUrl`
3. `appUpdate.storeUrl`
4. Build from `appStoreId` as `itms-apps://itunes.apple.com/app/id<appStoreId>`

Recommendation: always provide `appUpdate.ios.storeUrl`.

### Android

Order used by app:

1. `appUpdate.android.storeUrl`
2. `appUpdate.androidStoreUrl`
3. `appUpdate.storeUrl`
4. Fallback: `market://details?id=<android-bundle-id>`

Recommendation: provide both:

1. `https://play.google.com/store/apps/details?id=<bundle>`
2. (optional) market URL if needed elsewhere

## Example Responses

### 1) Force update both platforms

```json
{
  "env": "production",
  "enablePayments": true,
  "appUpdate": {
    "ios": {
      "force": true,
      "minimumSupportedVersion": "1.0.6",
      "minimumSupportedBuildNumber": 8,
      "storeUrl": "https://apps.apple.com/in/app/yosemite-crew/id6756180296"
    },
    "android": {
      "force": true,
      "minimumSupportedVersion": "1.0.6",
      "minimumSupportedBuildNumber": 8,
      "storeUrl": "https://play.google.com/store/apps/details?id=com.mobileappyc"
    }
  }
}
```

### 2) Optional update only (non-blocking)

```json
{
  "env": "production",
  "enablePayments": true,
  "appUpdate": {
    "ios": {
      "enabled": true,
      "latestVersion": "1.1.0",
      "latestBuildNumber": 12,
      "remindAfterHours": 24,
      "title": "Update available",
      "message": "A newer version is available.",
      "storeUrl": "https://apps.apple.com/in/app/yosemite-crew/id6756180296"
    },
    "android": {
      "enabled": true,
      "latestVersion": "1.1.0",
      "latestBuildNumber": 12,
      "remindAfterHours": 24,
      "title": "Update available",
      "message": "A newer version is available.",
      "storeUrl": "https://play.google.com/store/apps/details?id=com.mobileappyc"
    }
  }
}
```

### 3) No update policy

```json
{
  "env": "production",
  "enablePayments": true
}
```

## Backend Validation Requirements

1. Accept boolean-like values (`true/false` and string forms) for compatibility
2. Accept numeric strings for build numbers and `remindAfterHours`
3. Reject invalid payloads in admin/config write APIs (if you have one)
4. Enforce sane bounds:
   - `remindAfterHours >= 1`
   - non-negative build numbers
5. Ensure returned JSON is stable and fast (this runs at app startup)

## Rollout Strategy (Production)

1. Deploy backend support first with policy disabled
2. Return platform-specific store URLs
3. Turn on optional prompts first (`enabled=true`, `force=false`)
4. Monitor adoption and crash-free metrics
5. Turn on force only when enough users have upgraded

## Observability Requirements

At backend level, add logs/metrics for:

1. `mobile-config` fetch success/failure rate
2. Count of responses with `appUpdate` present
3. Environment/platform policy values served (sanitized; no secrets)

## API Caching Guidance

1. Keep response small and cacheable
2. If CDN/API cache is used, keep short TTL (example: 1-5 minutes)
3. Avoid stale force flags for long durations

## Security / Access

1. Endpoint may remain unauthenticated if already public for bootstrap
2. Config management path (admin panel/API) must be authenticated + audited
3. Do not expose any sensitive keys in this payload

## Acceptance Criteria

Backend implementation is complete when:

1. `GET /v1/mobile-config/` returns new `appUpdate` contract
2. Platform-specific override fields are supported (`ios`, `android`)
3. Existing clients without new logic remain unaffected
4. Payload can drive all three states:
   - no prompt
   - optional prompt
   - required force update
5. QA confirms both iOS and Android can reach store links from returned payload

## Notes For Current Mobile Client

The current React Native app already supports this contract and fallback order.
No mobile API shape change is needed beyond implementing these fields on backend.
