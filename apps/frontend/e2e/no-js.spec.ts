import { expect, test } from '@playwright/test';

/**
 * The no-JavaScript floor for the public surface.
 *
 * A `loading.tsx` is a Suspense boundary, and React streams a boundary's
 * content into a trailing `<div hidden id="S:n">` and swaps it into place with
 * an inline `$RC(...)` call. `src/app/loading.tsx` was a ROOT one, so every
 * route in the application carried that boundary - and with scripting off the
 * swap never happens, so the whole document stayed inside the hidden div and
 * the fullscreen loader was the entirety of what a reader got. Measured on a
 * production build before the fix, the visible text on `/`, `/developers`,
 * `/privacy-policy`, `/docs` and `/pricing` was the same 242 characters: the
 * skip link and the cookie notice. Marketing, legal and documentation pages
 * were blank. See issue #3510.
 *
 * These assertions measure VISIBILITY, which is the property a reader actually
 * has - and which only became measurable once the boundary was gone. While
 * #3510 was open, `toBeVisible` answered "hidden" for every element on every
 * page, so a JS-disabled assertion written this way passed whether the thing
 * under test was fixed or broken. That is why `docs-mobile.spec.ts` originally
 * had to read computed `display` instead.
 *
 * Measure against `next start`. `next dev` shows the same symptom for a
 * different reason, so a dev-server reading cannot tell the two apart; the CI
 * job that runs this file serves a production build, which is what makes it a
 * gate rather than a demonstration.
 */

const PHONE = { width: 390, height: 844 };

/*
 * The routes measured on the issue, each paired with the element carrying its
 * content. The selector is per-route on purpose: the marketing and legal pages
 * render `main.yc-public-page`, while the documentation renders `.DocsPage`
 * and has no `main` at all - so a single `main` selector would have silently
 * skipped the one route the defect was first found on.
 */
const PUBLIC_ROUTES = [
  { path: '/', content: 'main.yc-public-page' },
  { path: '/developers', content: 'main.yc-public-page' },
  { path: '/privacy-policy', content: 'main.yc-public-page' },
  { path: '/pricing', content: 'main.yc-public-page' },
  { path: '/docs', content: '.DocsPage' },
] as const;

test.describe('the public surface renders without JavaScript', () => {
  test.use({ viewport: PHONE, javaScriptEnabled: false });

  for (const { path, content } of PUBLIC_ROUTES) {
    test(`${path} paints its own content`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      const main = page.locator(content);

      /*
       * The defect's signature, asserted before visibility because it is what
       * says WHY on a failure. A deferred boundary does not drop the content -
       * it parks it in a trailing `<div hidden>`, so the element stays present
       * and findable for the whole time it is unreachable. `toBeVisible` alone
       * reports "not visible" for that and for a genuinely missing page alike.
       */
      await expect(main).toHaveCount(1);
      expect(await main.evaluate((el) => el.closest('[hidden]') !== null)).toBe(false);

      await expect(main).toBeVisible();

      /*
       * Not vacuous: an empty `main` would satisfy everything above. The floor
       * sits far below the shortest of these pages - the smallest measured
       * 3,185 characters - so ordinary copy edits never come near it, while
       * the 242-character loader-only document the defect produced is nowhere
       * close to clearing it.
       */
      const text = (await main.innerText()).trim();
      expect(text.length).toBeGreaterThan(1000);
    });
  }
});

/*
 * The consent card, which the root layout serves on every route.
 *
 * Its `Accept` and `Reject` controls pass `href="#"`, which `BaseButton`
 * treats as no href at all, so they render as bare `<button>` elements whose
 * only behaviour is an `onClick`. The decision is written to localStorage, so
 * with scripting off the card takes a press, records nothing, and stays.
 * Measured on a
 * production build at this viewport it held 508-760 of 844px, 30% of the
 * screen, and its subtree intercepted pointer events aimed at links that came
 * to rest under it. Consent here gates PostHog alone, which cannot run either,
 * so the card is withdrawn rather than made to work. See issue #3531.
 *
 * The JS-on arm below is the control. Without it this file could pass with the
 * card removed from the application entirely, which is a different change from
 * the one under test.
 */
const CONSENT_CARD = 'aside[aria-label="Cookie consent"]';

test.describe('the consent card is withdrawn without JavaScript', () => {
  test.use({ viewport: PHONE, javaScriptEnabled: false });

  test('/docs offers no consent control that cannot record an answer', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });

    const card = page.locator(CONSENT_CARD);

    /*
     * Present but not visible, asserted in that order. The rule that hides it
     * travels inside `<noscript>`, so the element is still served and still in
     * the DOM - `toHaveCount(0)` here would pass for the fix and for the card
     * having been deleted from the layout alike.
     */
    await expect(card).toHaveCount(1);
    await expect(card).toBeHidden();

    await expect(page.getByRole('button', { name: 'Accept' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeHidden();
  });
});

test.describe('the consent card still works with JavaScript', () => {
  test.use({ viewport: PHONE, javaScriptEnabled: true });

  test('/docs shows the card and dismisses it on Accept', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });

    const card = page.locator(CONSENT_CARD);
    await expect(card).toBeVisible();

    /*
     * Wait for React to adopt the button before pressing it, the same way and
     * for the same reason `docs-mobile.spec.ts` waits on `.DocsNavToggle`:
     * since #3510 the public surface is ordinary markup, so the card paints
     * immediately and a click can land tens of milliseconds before the
     * `onClick` exists. Measured here without this wait, the press was
     * swallowed and the card stayed up - which is indistinguishable from the
     * defect under test, and would have read as this fix breaking the JS-on
     * path. A visible element cannot report that it is hydrated;
     * `__reactProps$` is the only thing on the page that does.
     */
    await page.waitForFunction(() => {
      const accept = document.querySelector('aside[aria-label="Cookie consent"] button');
      return accept !== null && Object.keys(accept).some((key) => key.startsWith('__reactProps$'));
    });

    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(card).toBeHidden();
  });
});

/*
 * The auth forms submit with POST.
 *
 * Before hydration, pressing the submit button is an ordinary form submission,
 * and a form with no `method` sends its fields as a query string. `AuthForm`
 * pins `method="post"`, so the values travel in the request body and the page
 * renders again at a clean URL.
 *
 * The application bundles are blocked rather than scripting turned off: the
 * inline scripts that reveal streamed Suspense content still run, so the form
 * is on screen exactly as it is in the moment before React hydrates it.
 */
const AUTH_FORMS = [
  { path: '/signin', fields: ['Work email', 'Password'], submit: 'Sign in' },
  { path: '/developers/signin', fields: ['Work email', 'Password'], submit: 'Sign in' },
  { path: '/signup', fields: ['Enter email', 'Set up password'], submit: 'Create account' },
  { path: '/forgot-password', fields: ['Work email'], submit: 'Send reset link' },
] as const;

test.describe('the auth forms submit with POST before hydration', () => {
  for (const { path, fields, submit } of AUTH_FORMS) {
    test(`${path} keeps field values out of the URL`, async ({ page }) => {
      await page.route('**/_next/static/chunks/**', (route) => route.abort());
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      for (const label of fields) {
        await page.getByLabel(label, { exact: true }).first().fill('e2e-value@example.com');
      }

      const [response] = await Promise.all([
        page.waitForResponse((res) => res.request().isNavigationRequest()),
        page.getByRole('button', { name: submit }).click(),
      ]);

      expect(response.request().method()).toBe('POST');
      expect(response.status()).toBe(200);
      const url = new URL(page.url());
      expect(url.pathname).toBe(path);
      expect(url.search).toBe('');
      await expect(page.locator('form[method="post"]')).toBeVisible();
    });
  }
});
