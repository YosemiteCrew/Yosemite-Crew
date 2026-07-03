import { expect, test, type Page } from '@playwright/test';

const LOGIN_PATH = '/signin';
const APP_ROUTE_PATTERN =
  /^\/(dashboard|appointments|organization|organizations|create-org|team-onboarding)(\/|$|\?)/;

const getRequiredEnv = (name: 'YC_E2E_EMAIL' | 'YC_E2E_PASSWORD') => {
  const value = process.env[name]?.trim();
  test.skip(!value, `${name} is required to run auth-flow.spec.ts`);
  return value ?? '';
};

const waitForAppRoute = async (page: Page) => {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toBe(LOGIN_PATH);
};

test('sign in lands on an app route and survives a reload', async ({ page }) => {
  test.setTimeout(90_000);

  const email = getRequiredEnv('YC_E2E_EMAIL');
  const password = getRequiredEnv('YC_E2E_PASSWORD');
  if (!email || !password) return;

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
