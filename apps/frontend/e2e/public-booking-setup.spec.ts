import { expect, test, type Page } from '@playwright/test';

// Signs in with a real credential, exactly as auth-flow.spec.ts does, so the
// same artefact suppression applies: Playwright records input values verbatim
// and the config default is `trace: 'on-first-retry'`, which would capture the
// filled password field. The AI error-context snapshot is a separate sink gated
// by PLAYWRIGHT_NO_COPY_PROMPT, which the playwright-auth job sets.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const LOGIN_PATH = '/signin';
const SETUP_PATH = '/public-booking-setup';

const getRequiredEnv = (name: 'YC_E2E_EMAIL' | 'YC_E2E_PASSWORD') => {
  const value = process.env[name]?.trim();
  test.skip(!value, `${name} is required to run public-booking-setup.spec.ts`);
  return value ?? '';
};

/**
 * The booking-page configuration API ships in the same change as this page, and
 * the migration behind it must be deployed before the frontend that reads it.
 * Until the target environment has both, the route renders but every save 404s.
 *
 * Only a 404 justifies a skip - it means "this environment has not taken the
 * API yet". A 5xx means the endpoint IS deployed and broken, which is precisely
 * what this spec exists to catch, so it fails instead. Same reasoning as
 * `skipUnlessAuthSurfaceDeployed` in auth-flow.spec.ts.
 */
const skipUnlessBookingApiDeployed = async () => {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!base) return;

  const response = await fetch(`${base}/v1/booking-page/probe-not-a-real-org`, {
    method: 'GET',
  });

  test.skip(
    response.status === 404,
    'Target API does not serve /v1/booking-page yet (frontend deployed ahead of the API)'
  );

  if (response.status >= 500) {
    throw new Error(`Booking page API is deployed but failing: returned ${response.status}`);
  }
};

const signIn = async (page: Page) => {
  const email = getRequiredEnv('YC_E2E_EMAIL');
  const password = getRequiredEnv('YC_E2E_PASSWORD');
  if (!email || !password) return false;

  await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 30_000 });

  const emailInput = page.locator('input[name="email"]');
  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toBe(LOGIN_PATH);
  return true;
};

test('booking setup persists across a reload and never shows a dead address', async ({ page }) => {
  test.setTimeout(120_000);

  if (!(await signIn(page))) return;
  await skipUnlessBookingApiDeployed();

  await page.goto(SETUP_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('What can pet parents book?')).toBeVisible({ timeout: 30_000 });

  // Step 1: pick a non-default booking window so the assertion after reload is
  // about stored state rather than about the default happening to match.
  const windowSelect = page.getByLabel('Bookable window');
  await expect(windowSelect).toBeVisible();
  await windowSelect.selectOption('56');

  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Your booking page')).toBeVisible();

  // The whole point of the change: the wizard must never render the
  // book.yosemitecrew.com address, which has no DNS record.
  await expect(page.locator('body')).not.toContainText('book.yosemitecrew.com');

  // An unpublished practice is offered no link to copy, because there is
  // nothing at the other end of one yet.
  await expect(page.getByRole('button', { name: /^Copy$/ })).toHaveCount(0);

  const saveRequest = page.waitForResponse(
    (response) =>
      response.url().includes('/v1/booking-page/') && response.request().method() === 'PUT'
  );
  await page.getByRole('button', { name: /Save booking setup/ }).click();

  const response = await saveRequest;
  expect(response.status()).toBe(200);

  // Reload and confirm the choice came back from the server rather than from
  // component state. This is the assertion the Jest suite cannot make.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Bookable window')).toHaveValue('56', { timeout: 30_000 });
});
