import { expect, test } from '@playwright/test';

test('app shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Yosemite|Crew|YC/i);
});

/**
 * The public booking page, exercised without a session.
 *
 * This runs in the `playwright-public` job, which is the only end-to-end job
 * that runs on a pull request - so unlike the authenticated booking-setup spec,
 * this one actually gates the change. It uses a slug nobody owns, which needs no
 * fixture data and asserts the property that matters most on an internet-facing
 * route: an unknown practice produces a plain "not available" page rather than a
 * crash, a stack trace, or anything that distinguishes "no such slug" from "not
 * published".
 */
test('an unknown booking slug renders a plain unavailable page', async ({ page }) => {
  const response = await page.goto('/book/no-such-practice-e2e', {
    waitUntil: 'domcontentloaded',
  });

  // The route itself exists: only the practice is unknown.
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', { name: /this booking page is not available/i })
  ).toBeVisible({ timeout: 30_000 });

  const body = (await page.locator('body').textContent()) ?? '';
  expect(body).not.toMatch(/stack|prisma|postgres|at Object\./i);
});

test('the public booking page is served under a nonce CSP, not unsafe-inline', async ({ page }) => {
  const response = await page.goto('/book/no-such-practice-e2e', {
    waitUntil: 'domcontentloaded',
  });

  // The page collects a name, an email address and an animal's details, so it
  // must not inherit the permissive policy the marketing routes carry. Asserted
  // end to end because the middleware prefix list and the route group have to
  // agree, and a unit test can only check one of them.
  const csp = response?.headers()['content-security-policy'] ?? '';
  const scriptSrc = csp.split('; ').find((directive) => directive.startsWith('script-src'));

  expect(scriptSrc).toBeDefined();
  expect(scriptSrc).toContain('nonce-');
  expect(scriptSrc).not.toContain("'unsafe-inline'");
});
