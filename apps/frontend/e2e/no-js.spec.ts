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
