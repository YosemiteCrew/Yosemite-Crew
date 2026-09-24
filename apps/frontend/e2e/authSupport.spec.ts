import { expect, test, type Page } from '@playwright/test';
import {
  LAST_ACTIVE_ORG_ID_KEY,
  isRouteAbsent,
  isTeardownError,
  pinPrimaryOrg,
  submitSignIn,
} from './support/auth';

/**
 * The org pin runs in every authenticated spec, which only run after a merge.
 * These drive it against pages served from a stand-in origin, so the pin is
 * checked on every pull request with no credentials in scope.
 */

const ORIGIN = 'http://auth-support.test';
const ORG_ID = '69eba183df65a8dcb14e6e99';

const serveAt = async (page: Page, pathname: string, body = '') => {
  await page.route(`${ORIGIN}${pathname}`, (route) =>
    route.fulfill({ contentType: 'text/html', body: `<!doctype html><body>${body}</body>` })
  );
  await page.goto(`${ORIGIN}${pathname}`);
};

const pinned = (page: Page) =>
  page.evaluate((key) => globalThis.localStorage.getItem(key), LAST_ACTIVE_ORG_ID_KEY);

test('pins the org in the open page and again in every page loaded after it', async ({ page }) => {
  await serveAt(page, '/signin');
  await pinPrimaryOrg(page, ORG_ID);
  expect(await pinned(page)).toBe(ORG_ID);

  // A later full load must carry the pin too, even if the key was replaced.
  await page.evaluate((key) => globalThis.localStorage.removeItem(key), LAST_ACTIVE_ORG_ID_KEY);
  await serveAt(page, '/dashboard');
  expect(await pinned(page)).toBe(ORG_ID);
});

test('changes nothing when no org id is configured', async ({ page }) => {
  await serveAt(page, '/signin');
  await pinPrimaryOrg(page, '');
  await serveAt(page, '/dashboard');
  expect(await pinned(page)).toBeNull();
});

test('can be set up before the first page is open', async ({ page }) => {
  // about:blank has no storage; the pin must not throw there, and must still
  // reach the first real page.
  await pinPrimaryOrg(page, ORG_ID);
  await serveAt(page, '/signin');
  expect(await pinned(page)).toBe(ORG_ID);
});

test('signing in applies the org from YC_E2E_ORG_ID', async ({ page }) => {
  const previous = process.env.YC_E2E_ORG_ID;
  process.env.YC_E2E_ORG_ID = ` ${ORG_ID} `;
  try {
    await serveAt(
      page,
      '/signin',
      `<input name="email"><input name="password" type="password"><button>Sign in</button>`
    );
    await submitSignIn(page, 'fixture@example.test', 'not-a-secret');
    expect(await pinned(page)).toBe(ORG_ID);
  } finally {
    if (previous === undefined) delete process.env.YC_E2E_ORG_ID;
    else process.env.YC_E2E_ORG_ID = previous;
  }
});

test('a deploy probe skips only on the framework 404 for a route the API does not serve', async () => {
  const expressAbsent = new Response('<pre>Cannot GET /v1/booking-page/x</pre>', { status: 404 });
  const appNotFound = new Response('{"message":"Booking page not found."}', { status: 404 });
  const unauthenticated = new Response('{"message":"Authentication required"}', { status: 401 });
  expect(await isRouteAbsent(expressAbsent)).toBe(true);
  expect(await isRouteAbsent(appNotFound)).toBe(false);
  expect(await isRouteAbsent(unauthenticated)).toBe(false);
  expect(
    await isRouteAbsent(new Response('<pre>Cannot POST /auth/signinup/code</pre>', { status: 404 }))
  ).toBe(true);
});

test('the relay drops only the errors a finished test leaves behind', () => {
  expect(isTeardownError(new Error('route.fetch: Test ended.'))).toBe(true);
  expect(isTeardownError(new Error('Target page, context or browser has been closed'))).toBe(true);
  expect(isTeardownError(new Error('route.fulfill: Route is already handled!'))).toBe(true);
  expect(isTeardownError(new Error('route.fetch: net::ERR_CONNECTION_REFUSED'))).toBe(false);
  expect(isTeardownError('Test ended')).toBe(false);
});
