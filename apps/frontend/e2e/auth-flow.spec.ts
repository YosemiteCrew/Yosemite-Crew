import { expect, test, type Page } from '@playwright/test';

const LOGIN_PATH = '/signin';
const APP_ROUTE_PATTERN =
  /^\/(dashboard|appointments|organization|organizations|create-org|team-onboarding)(\/|$|\?)/;

const getRequiredEnv = (name: 'YC_E2E_EMAIL' | 'YC_E2E_PASSWORD') => {
  const value = process.env[name]?.trim();
  test.skip(!value, `${name} is required to run auth-flow.spec.ts`);
  return value ?? '';
};

// The sign-in flow talks to the SuperTokens auth surface on the target API
// (#1672). Until that environment is cut over from the legacy provider, the
// routes this spec exercises do not exist there - skip instead of failing on
// an environment that has not been migrated yet.
const skipUnlessAuthSurfaceDeployed = async () => {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!base) return;
  let deployed = false;
  try {
    const response = await fetch(`${base}/auth/signinup/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', rid: 'passwordless' },
      body: JSON.stringify({}),
    });
    // The provider surface answers (even to a bad request) with a non-404;
    // a legacy backend has no such route.
    deployed = response.status !== 404 && response.status < 500;
  } catch {
    deployed = false;
  }
  test.skip(
    !deployed,
    'Target API does not serve the SuperTokens auth surface yet (pre-cutover environment)'
  );
};

const waitForAppRoute = async (page: Page) => {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toBe(LOGIN_PATH);
};

test('sign in lands on an app route and survives a reload', async ({ page }) => {
  test.setTimeout(90_000);

  const email = getRequiredEnv('YC_E2E_EMAIL');
  const password = getRequiredEnv('YC_E2E_PASSWORD');
  if (!email || !password) return;

  await skipUnlessAuthSurfaceDeployed();

  await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 30_000 });

  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);
  await passwordInput.fill(password);

  await page.getByRole('button', { name: /^sign in$/i }).click();

  await waitForAppRoute(page);

  const firstPath = new URL(page.url()).pathname;
  expect(firstPath).toMatch(APP_ROUTE_PATTERN);
  await expect(emailInput).toHaveCount(0);
  await expect(passwordInput).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  const secondPath = new URL(page.url()).pathname;
  expect(secondPath).toMatch(APP_ROUTE_PATTERN);
});
