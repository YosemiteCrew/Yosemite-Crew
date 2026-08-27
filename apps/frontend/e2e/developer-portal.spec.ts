import { expect, test } from '@playwright/test';
import {
  APP_ROUTE_PATTERN,
  DEVELOPER_LOGIN_PATH,
  LOGIN_PATH,
  getRequiredEnv,
  skipUnlessAuthSurfaceDeployed,
  submitSignIn,
  waitForRouteAwayFrom,
} from './support/auth';

/**
 * Regression cover for the developer portal locking out valid sessions.
 *
 * Both tests here rest on one fact: the YC_E2E_* account is an ordinary app
 * account, not a developer one. `auth-flow.spec.ts` is what establishes that -
 * it asserts sign-in lands on APP_ROUTE_PATTERN, which excludes
 * `/developers/*`. So this is exactly the account that used to be bounced.
 *
 * If that account is ever converted to a developer account, these tests stop
 * testing anything and start passing for the wrong reason. The first assertion
 * in each guards against that by failing if the portal lets it in.
 */

// Same reasoning as auth-flow.spec.ts: a real credential is typed here, and
// Playwright records input values verbatim. The config default of
// trace: 'on-first-retry' would capture the filled field.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('a non-developer keeps their session after visiting a developer route', async ({ page }) => {
  test.setTimeout(90_000);

  const email = getRequiredEnv('YC_E2E_EMAIL');
  const password = getRequiredEnv('YC_E2E_PASSWORD');
  if (!email || !password) return;

  await skipUnlessAuthSurfaceDeployed();

  // Sign in through the ORDINARY form, so the session under test is the one a
  // user would already have when they wander into the portal.
  await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 30_000 });
  await submitSignIn(page, email, password);
  await waitForRouteAwayFrom(page, LOGIN_PATH);

  const signedInPath = new URL(page.url()).pathname;
  expect(signedInPath).toMatch(APP_ROUTE_PATTERN);

  await page.goto('/developers/api-keys', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  // Blocked, and told why. The guard used to call signout() here instead.
  await expect(page.getByText(/isn'?t a developer account/i)).toBeVisible({ timeout: 30_000 });

  /* The point of the test: the session for the REST of the app is untouched.
     Being signed out of everything for opening a /developers/* URL is what made
     this look like broken credentials. */
  await page.goto(signedInPath, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  expect(new URL(page.url()).pathname).not.toBe(LOGIN_PATH);
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
});

test('developer sign-in with a non-developer account does not loop', async ({ page }) => {
  test.setTimeout(90_000);

  const email = getRequiredEnv('YC_E2E_EMAIL');
  const password = getRequiredEnv('YC_E2E_PASSWORD');
  if (!email || !password) return;

  await skipUnlessAuthSurfaceDeployed();

  await page.goto(DEVELOPER_LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 30_000 });

  await submitSignIn(page, email, password);

  /* The failure this replaces: sign-in succeeded, the redirect sent the user to
     /developers/home because the developer FORM was used, the guard rejected
     them and signed them out, and the resulting redirect landed back here - so
     the form appeared to reject a valid password, silently and forever. */
  await waitForRouteAwayFrom(page, DEVELOPER_LOGIN_PATH);

  const landed = new URL(page.url()).pathname;
  expect(landed).not.toBe(DEVELOPER_LOGIN_PATH);
  expect(landed).toMatch(APP_ROUTE_PATTERN);

  // Signed in, not bounced: the credentials were always fine.
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
});
