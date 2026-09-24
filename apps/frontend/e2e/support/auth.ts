import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { LAST_ACTIVE_ORG_ID_KEY } from '../../src/app/stores/orgStorageKeys';

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
 * Excludes `/developers/*`. This does NOT prove the YC_E2E_* account is an
 * ordinary app account: an account holding both a practice membership and the
 * developer role also lands here when it signs in through the ordinary form.
 * `signedInRoles` below is what checks that.
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
/**
 * Whether a probe hit a route the target API does not serve. Express answers an unknown
 * route with its own HTML "Cannot GET/POST" page; the app answers every route it serves
 * with JSON, including its own 404s (an unknown org, an unknown id). Only the former
 * means "not deployed", so a status code alone cannot decide a skip.
 */
export const isRouteAbsent = async (response: Response) =>
  response.status === 404 && /Cannot (GET|POST|PUT|PATCH|DELETE) /.test(await response.text());

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

  const absent = await isRouteAbsent(response);
  console.log(
    `auth surface probe: HTTP ${response.status}${absent ? ' (route not deployed)' : ''}`
  );
  test.skip(
    absent,
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
 * True for the errors Playwright raises when a relayed request is still in flight as a
 * test finishes (the page or context is gone, or the test has ended). Nothing is waiting
 * for that response any more, so the relay drops it instead of failing the run.
 */
export const isTeardownError = (error: unknown) =>
  error instanceof Error &&
  /Test ended|Target page, context or browser has been closed|Route is already handled/.test(
    error.message
  );

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
    let response;
    try {
      response = await route.fetch();
    } catch (error) {
      if (isTeardownError(error)) return;
      throw error;
    }
    // The body arrives decoded, so the encoding and length no longer describe it.
    const headers = Object.fromEntries(
      Object.entries(response.headers()).filter(
        ([name]) => name !== 'content-encoding' && name !== 'content-length'
      )
    );
    await route
      .fulfill({
        response,
        headers: {
          ...headers,
          ...cors,
          'access-control-expose-headers': Object.keys(headers).join(','),
        },
      })
      .catch((error: unknown) => {
        if (!isTeardownError(error)) throw error;
      });
  });
};

/** The key orgStore.setOrgs reads for the primary org when no choice is persisted. */
export { LAST_ACTIVE_ORG_ID_KEY };

/**
 * Makes the app open `orgId` as the primary org for the account that signs in next.
 *
 * With nothing saved, the primary org is the account's first membership, and the
 * API lists memberships in no defined order. The YC_E2E_* account belongs to
 * several orgs, and the specs rely on one of them (verified, with a companion),
 * so which org a run tested depended on row order in the database. setOrgs
 * honours this key only when the id is one of the account's memberships, so a
 * wrong or stale id falls back to today's behaviour instead of failing.
 *
 * Set in the current document, which is the sign-in page, and in every later
 * one, since the app can leave sign-in by a client-side push or a full load.
 * An empty id changes nothing.
 */
export const pinPrimaryOrg = async (
  page: Page,
  orgId: string | undefined = process.env.YC_E2E_ORG_ID?.trim()
) => {
  if (!orgId) return;
  const pin = ([key, id]: [string, string]) => {
    try {
      globalThis.localStorage.setItem(key, id);
    } catch {
      // A document without storage (about:blank, an opaque frame) has nothing to pin.
    }
  };
  const args: [string, string] = [LAST_ACTIVE_ORG_ID_KEY, orgId];
  await page.addInitScript(pin, args);
  // A document replaced mid-call has no context left to pin; the init script above
  // pins its replacement, so that one failure mode is safe to ignore.
  await page.evaluate(pin, args).catch(() => {});
};

/** Fills and submits whichever sign-in form is currently on screen. */
export const submitSignIn = async (page: Page, email: string, password: string) => {
  await relayApiForLoopbackApp(page);
  await pinPrimaryOrg(page);
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);
  await passwordInput.fill(password);

  await page.getByRole('button', { name: /^sign in$/i }).click();
};

/**
 * The roles `/v1/auth/me` reports for the next account to sign in on this page.
 * Start it BEFORE submitting the form, then await it.
 *
 * Only `roles` is read. The same body carries the account's email, which is a
 * secret here, so it is never returned, logged or put in an assertion message.
 */
export const signedInRoles = (page: Page): Promise<string[]> => {
  const roles = page
    .waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/v1/auth/me') && response.status() === 200,
      { timeout: 60_000 }
    )
    .then(async (response) => {
      const { roles: held } = (await response.json()) as { roles?: unknown };
      if (!Array.isArray(held)) throw new Error('/v1/auth/me answered without a roles list');
      return held.map((role) => String(role).trim().toLowerCase());
    });
  // Awaited later. Without this, a test that fails before then (and closes the
  // page) would also report the abandoned wait as an unhandled rejection.
  roles.catch(() => {});
  return roles;
};

/**
 * Fails, with a message naming the cause, when the YC_E2E_* account holds the
 * developer role. The developer-portal specs test how the portal treats an
 * ordinary account; given a developer one they time out with no explanation.
 */
export const expectNotADeveloper = (roles: readonly string[]) =>
  expect(
    roles,
    'Fixture drift: the YC_E2E_* account holds the developer role on this environment. ' +
      'These specs need an ordinary app account; remove the role from the account ' +
      'rather than changing the spec.'
  ).not.toContain('developer');

/** Waits until the router has moved off `fromPath`. */
export const waitForRouteAwayFrom = async (page: Page, fromPath: string) => {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toBe(fromPath);
};
