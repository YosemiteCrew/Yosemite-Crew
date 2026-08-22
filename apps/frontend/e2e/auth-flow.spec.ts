import { expect, test, type Page } from '@playwright/test';

// This spec types a real credential into the sign-in form, and Playwright
// records input values verbatim. Force trace, screenshot and video off for this
// file (the config default is trace: 'on-first-retry', which would capture the
// filled field). This does NOT cover the AI error-context snapshot, which is a
// separate on-failure sink gated only by PLAYWRIGHT_NO_COPY_PROMPT - that is set
// in the playwright-auth job env, not here. Together they keep the password off
// the runner's disk. Defence in depth: the job also uploads no artifacts.
// Scoped to this file so other specs keep their debugging artefacts.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

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
  // Only a 404 means "this environment has not cut over yet" and justifies a
  // skip. A 5xx means the auth surface IS deployed and broken, and a failed
  // probe means we do not know - treating either as "not deployed" silently
  // skipped the core sign-in test through exactly the outages it exists to
  // catch.
  const response = await fetch(`${base}/auth/signinup/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', rid: 'passwordless' },
    body: JSON.stringify({}),
  });

  test.skip(
    response.status === 404,
    'Target API does not serve the SuperTokens auth surface yet (pre-cutover environment)'
  );

  if (response.status >= 500) {
    throw new Error(
      `Auth surface is deployed but failing: ${base}/auth/signinup/code returned ${response.status}`
    );
  }
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
