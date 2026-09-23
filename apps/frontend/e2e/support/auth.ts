import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Shared plumbing for the specs that sign in with a real credential.
 *
 * Extracted so the credential handling and the pre-cutover skip live in one
 * place: both are security-relevant enough that two drifting copies would be a
 * liability. Callers still have to set `trace`/`screenshot`/`video` off
 * themselves - that is a per-file `test.use`, which cannot be applied from here.
 */

export const LOGIN_PATH = '/signin';
export const DEVELOPER_LOGIN_PATH = '/developers/signin';

/**
 * Routes the main app can legitimately land on after sign-in.
 *
 * Deliberately excludes `/developers/*`: the account behind YC_E2E_* is an
 * ordinary app account, and this pattern is part of how we know that.
 */
export const APP_ROUTE_PATTERN =
  /^\/(dashboard|appointments|organization|organizations|create-org|team-onboarding)(\/|$|\?)/;

export const getRequiredEnv = (name: 'YC_E2E_EMAIL' | 'YC_E2E_PASSWORD') => {
  const value = process.env[name]?.trim();
  test.skip(!value, `${name} is required to run this spec`);
  return value ?? '';
};

/**
 * The sign-in flow talks to the SuperTokens auth surface on the target API
 * (#1672). Until that environment is cut over from the legacy provider, the
 * routes these specs exercise do not exist there - skip instead of failing on
 * an environment that has not been migrated yet.
 */
export const skipUnlessAuthSurfaceDeployed = async () => {
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

const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])$/;
const relayedContexts = new WeakSet<BrowserContext>();

/**
 * Sends the app's API calls from the Playwright runner when the app is served on
 * loopback against a deployed API.
 *
 * Deployed, app and API are same-site (dev.yosemitecrew.com and
 * devapi.yosemitecrew.com): the API's CORS allowlist admits the page and its
 * SameSite=Lax session cookies travel. Served from 127.0.0.1 in CI, neither holds.
 * The preflight is refused before sign-in leaves the browser (every run of the
 * authenticated job timed out on /signin), and a cookie set by a cross-site
 * response is dropped. `route.fetch()` sends each request with the context's
 * cookie jar and stores what the API sets. So every call is still answered by the
 * real API and the real session is still exercised; only those two same-site
 * guarantees are stood in for. A deployed target (E2E_BASE_URL) is left untouched.
 */
const relayApiForLoopbackApp = async (page: Page) => {
  const context = page.context();
  const apiBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const appOrigin = new URL(page.url()).origin;
  if (!apiBase || !LOOPBACK_HOST.test(new URL(appOrigin).hostname)) return;
  if (relayedContexts.has(context)) return;
  relayedContexts.add(context);

  const cors = {
    'access-control-allow-origin': appOrigin,
    'access-control-allow-credentials': 'true',
  };
  await context.route(`${new URL(apiBase).origin}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      const asked = request.headers();
      await route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': asked['access-control-request-method'] ?? 'GET',
          'access-control-allow-headers': asked['access-control-request-headers'] ?? '',
        },
      });
      return;
    }
    const response = await route.fetch();
    // The body arrives decoded, so the encoding and length no longer describe it.
    const headers = Object.fromEntries(
      Object.entries(response.headers()).filter(
        ([name]) => name !== 'content-encoding' && name !== 'content-length'
      )
    );
    await route.fulfill({
      response,
      headers: {
        ...headers,
        ...cors,
        'access-control-expose-headers': Object.keys(headers).join(','),
      },
    });
  });
};

/** Fills and submits whichever sign-in form is currently on screen. */
export const submitSignIn = async (page: Page, email: string, password: string) => {
  await relayApiForLoopbackApp(page);
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);
  await passwordInput.fill(password);

  await page.getByRole('button', { name: /^sign in$/i }).click();
};

/** Waits until the router has moved off `fromPath`. */
export const waitForRouteAwayFrom = async (page: Page, fromPath: string) => {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toBe(fromPath);
};
