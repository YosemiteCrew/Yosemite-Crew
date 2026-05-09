import { expect, test } from '@playwright/test';

const LOGIN_PATH = '/signin';
const APP_ROUTE_PATTERN =
  /^\/(dashboard|appointments|organization|organizations|create-org|team-onboarding)(\/|$|\?)/;

const getRequiredEnv = (name: 'YC_E2E_EMAIL' | 'YC_E2E_PASSWORD') => {
  const value = process.env[name]?.trim();
  test.skip(!value, `${name} is required to run auth-flow.spec.ts`);
  return value ?? '';
};

test('sign in redirects into an app route and survives a reload', async ({ page }) => {
  test.setTimeout(90_000);
  const email = getRequiredEnv('YC_E2E_EMAIL');
  const password = getRequiredEnv('YC_E2E_PASSWORD');
  if (!email || !password) return;

  await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 30_000 });
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await page.waitForURL((url) => !url.pathname.startsWith(LOGIN_PATH), {
    timeout: 60_000,
  });

  const firstPath = new URL(page.url()).pathname;
  expect(firstPath).toMatch(APP_ROUTE_PATTERN);
  await expect(page.getByRole('link', { name: /^sign in$/i })).toHaveCount(0);

  const firstBodyText = await page.locator('body').innerText();
  expect(firstBodyText.trim().length).toBeGreaterThan(20);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  const secondPath = new URL(page.url()).pathname;
  expect(secondPath).toMatch(APP_ROUTE_PATTERN);

  const secondBodyText = await page.locator('body').innerText();
  expect(secondBodyText.trim().length).toBeGreaterThan(20);
});
