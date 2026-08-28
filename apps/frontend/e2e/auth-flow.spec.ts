import { expect, test } from '@playwright/test';
import {
  APP_ROUTE_PATTERN,
  LOGIN_PATH,
  getRequiredEnv,
  skipUnlessAuthSurfaceDeployed,
  submitSignIn,
  waitForRouteAwayFrom,
} from './support/auth';

// This spec types a real credential into the sign-in form, and Playwright
// records input values verbatim. Force trace, screenshot and video off for this
// file (the config default is trace: 'on-first-retry', which would capture the
// filled field). This does NOT cover the AI error-context snapshot, which is a
// separate on-failure sink gated only by PLAYWRIGHT_NO_COPY_PROMPT - that is set
// in the playwright-auth job env, not here. Together they keep the password off
// the runner's disk. Defence in depth: the job also uploads no artifacts.
// Scoped to this file so other specs keep their debugging artefacts.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('sign in lands on an app route and survives a reload', async ({ page }) => {
  test.setTimeout(90_000);

  const email = getRequiredEnv('YC_E2E_EMAIL');
  const password = getRequiredEnv('YC_E2E_PASSWORD');
  if (!email || !password) return;

  await skipUnlessAuthSurfaceDeployed();

  await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 30_000 });

  await submitSignIn(page, email, password);

  await waitForRouteAwayFrom(page, LOGIN_PATH);

  const firstPath = new URL(page.url()).pathname;
  expect(firstPath).toMatch(APP_ROUTE_PATTERN);
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  const secondPath = new URL(page.url()).pathname;
  expect(secondPath).toMatch(APP_ROUTE_PATTERN);
});
