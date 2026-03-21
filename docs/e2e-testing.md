# E2E Testing Setup (Web + Mobile)

This monorepo now includes:

- `apps/frontend`: Playwright E2E setup for Next.js web app.
- `apps/mobileAppYC`: Detox E2E setup for React Native CLI app.

## Why this stack

- Web (`Next.js`): `Playwright` is the best fit for fast, stable browser E2E and good CI support.
- Mobile (`React Native CLI`): `Detox` is the best fit for true device/simulator-level E2E.

## Important install note

In this environment, package download was blocked (no access to npm registry), so dependencies were added to `package.json` but not fetched locally.

Run this once on your machine:

```bash
pnpm install
```

Then for Playwright browser binaries:

```bash
cd apps/frontend
pnpm exec playwright install
```

## Web E2E (Playwright)

Files added:

- `apps/frontend/playwright.config.ts`
- `apps/frontend/e2e/smoke.spec.ts`

Scripts:

- `pnpm --filter frontend e2e`
- `pnpm --filter frontend e2e:headed`
- `pnpm --filter frontend e2e:ui`

### How tests run

1. Playwright starts Next dev server on port `3001`.
2. Runs tests in `apps/frontend/e2e`.
3. Retries on CI and stores traces for failing retries.

### How to add tests

Create a new file in `apps/frontend/e2e`, for example:

```ts
import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('qa@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Dashboard')).toBeVisible();
});
```

## Mobile E2E (Detox)

Files added:

- `apps/mobileAppYC/.detoxrc.js`
- `apps/mobileAppYC/e2e/jest.config.js`
- `apps/mobileAppYC/e2e/smoke.e2e.js`

Scripts:

- `pnpm --filter mobileAppYC e2e:build:ios`
- `pnpm --filter mobileAppYC e2e:ios`
- `pnpm --filter mobileAppYC e2e:build:android`
- `pnpm --filter mobileAppYC e2e:android`

### How tests run

1. Detox builds debug app binary for simulator/emulator.
2. Launches the app with a fresh instance.
3. Executes tests from `apps/mobileAppYC/e2e/*.e2e.js`.

### How to add tests

Create a new spec in `apps/mobileAppYC/e2e`, for example:

```js
describe('Login flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('logs in successfully', async () => {
    await element(by.id('email-input')).typeText('qa@example.com');
    await element(by.id('password-input')).typeText('password');
    await element(by.id('login-submit')).tap();
    await expect(element(by.text('Home'))).toBeVisible();
  });
});
```

## Recommended flow in CI

1. Unit tests first (`jest`) for fast feedback.
2. Web E2E (Playwright) on each PR.
3. Mobile E2E (Detox) on merge/nightly (heavier runtime).
