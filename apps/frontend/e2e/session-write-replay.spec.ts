import { expect, test } from '@playwright/test';

/*
 * The API origin the app was BUILT with, not an arbitrary loopback port.
 *
 * Two things pin this, and only one of them is the route interception. The
 * SuperTokens replay guard under test is installed for
 * `resolveApiDomain(NEXT_PUBLIC_BASE_URL)` (`authClient.ts:123`) and ignores
 * every other origin, so a request somewhere else is not the thing being
 * measured. And `securityHeaders.ts:175` lists `connect-src` explicitly, with
 * a blanket `http:` added only when `isDevelopment` - so a hardcoded
 * `http://127.0.0.1:3999` is permitted under `next dev` and REFUSED BY CSP
 * under `next start`, before any request leaves the page. That is why this
 * spec passed where it was written and could never have passed in CI: the
 * failure is a console CSP violation and a `TypeError: Failed to fetch`, with
 * no network request for a route handler to see. See issue #3535.
 *
 * Nothing real is contacted: every call to this origin is fulfilled by
 * `page.route` below.
 */
const API_ORIGIN = (
  process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://devapi.yosemitecrew.com'
).replace(/\/$/, '');
const APP_ORIGIN = (process.env.E2E_BASE_URL?.trim() || 'http://127.0.0.1:3001').replace(/\/$/, '');
const APP_HOST = new URL(APP_ORIGIN).hostname;
const APPOINTMENT_URL = `${API_ORIGIN}/v1/appointments/appointment-1`;

const corsHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'anti-csrf,content-type,fdi-version,rid,st-auth-mode',
  'access-control-allow-methods': 'GET,HEAD,OPTIONS,PATCH,POST',
  'access-control-allow-origin': APP_ORIGIN,
  'access-control-expose-headers': 'front-token',
};

test('refreshes safe reads but requires explicit resubmission for writes', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  const frontToken = Buffer.from(
    JSON.stringify({ uid: 'synthetic-user', ate: Date.now() + 60_000, up: { role: 'staff' } })
  ).toString('base64');
  let getAttempts = 0;
  const writeBodies: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (request.url().endsWith('/auth/session/refresh')) {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'front-token': frontToken },
      });
      return;
    }
    if (request.method() === 'GET') {
      /*
       * Only the appointment read is counted and only it is refused once. The
       * application issues its own reads against this origin while `/signin`
       * loads, and counting those made the 401 land on a page-load request
       * instead of on the read under test - `getAttempts` reached 8, and the
       * one GET this test performs was never the first. The property being
       * measured is that a SAFE read is retried after a refresh, so the
       * request it is measured on has to be the test's own.
       */
      if (request.url() !== APPOINTMENT_URL) {
        await route.fulfill({ status: 200, headers: corsHeaders });
        return;
      }
      getAttempts += 1;
      await route.fulfill({ status: getAttempts === 1 ? 401 : 200, headers: corsHeaders });
      return;
    }

    writeBodies.push(request.postData() ?? '');
    await route.fulfill({
      status: writeBodies.length === 1 ? 401 : 200,
      headers: corsHeaders,
    });
  });

  await page.goto('/signin', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[name="email"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
  await page.waitForFunction(
    () =>
      typeof (
        globalThis.window as typeof globalThis.window & {
          __supertokensOriginalFetch?: typeof fetch;
        }
      ).__supertokensOriginalFetch === 'function'
  );
  await context.addCookies([
    { name: 'sFrontToken', value: frontToken, domain: APP_HOST, path: '/' },
    { name: 'st-last-access-token-update', value: '1', domain: APP_HOST, path: '/' },
  ]);

  const sdkState = await page.evaluate(() => {
    const browserWindow = globalThis.window as typeof globalThis.window & {
      __supertokensOriginalFetch?: typeof fetch;
    };
    return {
      cookies: document.cookie,
      interceptorInstalled: typeof browserWindow.__supertokensOriginalFetch === 'function',
    };
  });
  expect(sdkState.interceptorInstalled).toBe(true);
  expect(sdkState.cookies).toContain('sFrontToken=');

  const blockedWrite = await page.evaluate(async (url) => {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 7, status: 'complete' }),
    });
    return {
      replayBlocked: response.headers.get('x-yc-session-write-replay-blocked'),
      status: response.status,
    };
  }, APPOINTMENT_URL);

  expect(blockedWrite).toEqual({ replayBlocked: 'true', status: 401 });
  expect(writeBodies).toEqual([JSON.stringify({ expectedVersion: 7, status: 'complete' })]);

  const explicitResubmissionStatus = await page.evaluate(async (url) => {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 8, status: 'complete' }),
    });
    return response.status;
  }, APPOINTMENT_URL);
  const readStatus = await page.evaluate(async (url) => (await fetch(url)).status, APPOINTMENT_URL);

  expect(explicitResubmissionStatus).toBe(200);
  expect(writeBodies).toEqual([
    JSON.stringify({ expectedVersion: 7, status: 'complete' }),
    JSON.stringify({ expectedVersion: 8, status: 'complete' }),
  ]);
  expect(readStatus).toBe(200);
  expect(getAttempts).toBe(2);
});
