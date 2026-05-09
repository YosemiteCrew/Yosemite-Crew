# PostHog Analytics Migration

This document replaces Yosemite Crew's Microsoft Clarity integration with PostHog for product analytics on the web PMS and the mobile app.

## What changed

- Web (`apps/frontend`)
  - Replaced the Clarity script loader with a consent-gated PostHog bootstrap.
  - Enabled PostHog heatmaps after consent.
  - Added URL and sensitive-property scrubbing before events leave the browser.
  - Added PostHog CSP allowlists.
  - Synced authenticated users to PostHog with `identify()` using safe person properties.
- Mobile (`apps/mobileAppYC`)
  - Removed the Clarity SDK dependency.
  - Added a PostHog React Native client wrapper with secure defaults.
  - Replaced manual Clarity screen tracking with PostHog `screen()` tracking.
  - Left mobile tracking disabled by default until explicit enablement and consent decisions are in place.

## Security and privacy defaults

- Web analytics do not initialize until `cookieConsentGiven === 'true'`.
- Web capture uses `mask_all_text: true` and `mask_all_element_attributes: true`.
- Web events redact common secret fields such as `password`, `token`, `access_token`, `refresh_token`, and `authorization`.
- Web URLs are stripped of query strings and fragments before sending to PostHog.
- Web person profiles use `identified_only` to avoid creating person records for anonymous visitors.
- Mobile defaults to `enabled: false` and `defaultOptIn: false`.
- Mobile session replay is disabled by default.

## Frontend setup

Set the following environment variables in `apps/frontend/.env`:

```env
NEXT_PUBLIC_POSTHOG_TOKEN=phc_your_project_token
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Recommended production setup:

- Use a dedicated PostHog project for the PMS.
- If you operate in the EU region, use `https://eu.i.posthog.com`.
- Prefer a first-party reverse proxy for `/ingest` and `/static` if you want to minimize third-party network visibility and simplify ad-blocker resilience.
- Keep consent text accurate. The web app now states that analytics are optional and only enabled after opt-in.

## Mobile setup

Configure `POSTHOG_CONFIG` in `apps/mobileAppYC/src/config/variables.local.ts`:

```ts
export const POSTHOG_CONFIG = {
  apiKey: 'phc_your_project_token',
  captureScreens: true,
  defaultOptIn: false,
  enableSessionReplay: false,
  enabled: false,
  host: 'https://us.i.posthog.com',
};
```

Recommended production rollout for mobile:

1. Ship with `enabled: false` until your in-app consent/preferences flow is complete.
2. Once consent exists, keep `defaultOptIn: false` unless legal review approves default opt-in for your jurisdictions.
3. Only enable session replay after validating masking on real veterinary workflows and PHI-adjacent screens.

## Operational guidance

- Do not send appointment notes, clinical free text, signed consent data, or payment secrets as event properties.
- Use `data-ph-no-capture` on any web container that must never be captured.
- Use `data-ph-mask` on any web text that should remain visible in the UI but masked in analytics tooling.
- If you add custom mobile capture calls, keep payloads metadata-only and avoid user-entered medical or financial content.

## Verification checklist

- Web:
  - Rejecting cookies keeps PostHog disabled.
  - Accepting cookies initializes PostHog and enables heatmaps.
  - Logging in identifies the user with non-sensitive traits only.
  - CSP allows PostHog assets and ingest calls without broadening unrelated origins.
- Mobile:
  - App boot succeeds with PostHog disabled.
  - Screen navigation calls `screen()` only when PostHog is enabled and configured.
  - No mobile analytics are sent until the app explicitly opts in.

## References

- PostHog Next.js docs: https://posthog.com/docs/libraries/next-js
- PostHog JavaScript config docs: https://posthog.com/docs/libraries/js/config
- PostHog React Native docs: https://posthog.com/docs/libraries/react-native
- PostHog session replay privacy docs: https://posthog.com/docs/session-replay/privacy
