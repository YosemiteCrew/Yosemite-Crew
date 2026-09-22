import { expect, test } from '@playwright/test';

test('app shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Yosemite|Crew|YC/i);
});

test('mobile docs keep the article above a collapsible navigation tree', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  const toggle = page.getByRole('button', { name: 'Documentation menu' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.DocsNavItems')).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Yosemite Crew Overview' })
  ).toBeInViewport();

  await toggle.focus();
  await toggle.press('Enter');

  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.DocsNavItems')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Notification Setup Guide' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('.DocsNavItems a').first()).toBeFocused();
});

test('tablet docs keep navigation collapsed until requested', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 900 });
  await page.goto('/docs', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('button', { name: 'Documentation menu' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  await expect(page.locator('.DocsNavItems')).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Yosemite Crew Overview' })
  ).toBeInViewport();
});

test('desktop docs keep the navigation persistently visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/docs', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('button', { name: 'Documentation menu' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Notification Setup Guide' })).toBeVisible();
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

  // innerText, not textContent. textContent returns the raw DOM text of every
  // descendant INCLUDING <script>, so it swept up Next's RSC payload - which
  // legitimately serialises React owner stacks as "stack":[] and tripped this
  // regex on a page showing nothing of the sort. innerText is the rendered text,
  // which is what this assertion has always been about: what a visitor can read.
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toMatch(/stack|prisma|postgres|at Object\./i);
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
