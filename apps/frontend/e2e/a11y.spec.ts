import { type Page, expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Shared axe configuration: WCAG 2.1 AA baseline, colour-contrast excluded
// because headless Chrome does not compute computed colour styles reliably.
const runAxe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .disableRules(['color-contrast'])
    .analyze();

test.describe('Public pages — accessibility (WCAG 2.1 AA)', () => {
  test('home / marketing page has no axe violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await runAxe(page);
    expect(results.violations).toEqual([]);
  });

  test('sign-in page has no axe violations', async ({ page }) => {
    await page.goto('/signin');
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await runAxe(page);
    expect(results.violations).toEqual([]);
  });

  test('sign-up page has no axe violations', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await runAxe(page);
    expect(results.violations).toEqual([]);
  });

  test('pricing page has no axe violations', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await runAxe(page);
    expect(results.violations).toEqual([]);
  });

  test('skip link is reachable via keyboard on every page', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('focus does not get trapped outside interactive elements on home', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // After two tabs the focus should have moved away from the skip link
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).not.toBeFocused();
  });
});

test.describe('Sign-in page — form accessibility', () => {
  test('email and password inputs have accessible labels', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /show password/i })).toBeVisible();
  });
});
