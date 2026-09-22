import { type Page, expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The public documentation at a phone width.
 *
 * Three defects shipped together here and all three are invisible to a desktop
 * run, so every assertion below states the viewport it holds at and is paired
 * with a desktop reading that must NOT change. The desktop halves are the
 * point: each fix is scoped to a media query, and a test that only looked at
 * 390px could not tell a scoped fix from one that rewrote the wide layout.
 */

const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 800 };
const DESKTOP = { width: 1280, height: 900 };

/* The docs pull nothing cross-origin, but the search index is a same-origin
   fetch on first focus; `load` plus fonts is enough and `networkidle` is not
   needed. Fonts matter: every width measured here is a text-fit question. */
const openDocs = async (page: Page) => {
  await page.goto('/docs');
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.DocsTopBar')).toBeVisible();
};

test.describe('docs code samples at a phone width', () => {
  test.use({ viewport: PHONE });

  test('wrap instead of opening a scroll region no keyboard can reach', async ({ page }) => {
    await openDocs(page);

    const blocks = await page.evaluate(() =>
      [...document.querySelectorAll('.DocsBody pre')].map((pre) => {
        const code = pre.querySelector('code') as HTMLElement;
        const wrapped = { scrollWidth: pre.scrollWidth, clientWidth: pre.clientWidth };
        /*
         * The control. Turning wrapping off in the page says how wide this
         * sample would be if the fix were removed - so a corpus that stopped
         * carrying a long line would fail here rather than passing an
         * assertion with nothing left to prove.
         */
        const previous = code.style.whiteSpace;
        code.style.whiteSpace = 'pre';
        const unwrappedScrollWidth = pre.scrollWidth;
        code.style.whiteSpace = previous;
        return { ...wrapped, unwrappedScrollWidth, whiteSpace: getComputedStyle(code).whiteSpace };
      })
    );

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((b) => b.unwrappedScrollWidth > b.clientWidth)).toBe(true);

    for (const block of blocks) {
      expect(block.whiteSpace).toBe('pre-wrap');
      expect(block.scrollWidth).toBeLessThanOrEqual(block.clientWidth);
    }
  });
});

for (const viewport of [
  { name: 'phone', size: PHONE },
  { name: 'desktop', size: DESKTOP },
]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`docs WCAG 2.1 AA, ${viewport.name}, ${colorScheme}`, () => {
      test.use({ viewport: viewport.size, colorScheme });

      test('has no violations and evaluates link-in-text-block', async ({ page }) => {
        await openDocs(page);

        const proseLink = page.locator('.DocsBody p a').first();
        const headingAnchor = page.locator('.DocsHeadingAnchor').first();
        await expect(proseLink).toBeVisible();
        await expect(headingAnchor).toBeVisible();
        await expect(proseLink).toHaveCSS('text-decoration-line', 'underline');
        await expect(headingAnchor).toHaveCSS('text-decoration-line', 'none');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();

        expect(results.violations).toEqual([]);
        expect(results.passes.some((rule) => rule.id === 'link-in-text-block')).toBe(true);
      });
    });
  }
}

test.describe('docs code samples on a wide window', () => {
  test.use({ viewport: DESKTOP });

  test('keep their original line breaks', async ({ page }) => {
    await openDocs(page);

    const whiteSpace = await page.evaluate(() =>
      [...document.querySelectorAll('.DocsBody pre code')].map(
        (c) => getComputedStyle(c).whiteSpace
      )
    );

    expect(whiteSpace.length).toBeGreaterThan(0);
    expect(new Set(whiteSpace)).toEqual(new Set(['pre']));
  });
});

test.describe('collapsed docs navigation at a phone width', () => {
  test.use({ viewport: PHONE });

  test('scrolls out of the viewport instead of covering the article', async ({ page }) => {
    await openDocs(page);

    const nav = page.locator('.DocsNav');
    await expect(nav).toHaveCSS('position', 'static');

    const before = await nav.evaluate((el) => el.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForFunction(() => window.scrollY > 1000);
    const after = await nav.evaluate((el) => el.getBoundingClientRect().top);

    // Sticky would hold it at the top bar; in flow it leaves with the page.
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(-500);
  });
});

test.describe('docs navigation on a wide window', () => {
  test.use({ viewport: DESKTOP });

  test('stays pinned while the article scrolls', async ({ page }) => {
    await openDocs(page);

    const nav = page.locator('.DocsNav');
    await expect(nav).toHaveCSS('position', 'sticky');

    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForFunction(() => window.scrollY > 1000);

    expect(await nav.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(0);
  });
});

/**
 * Measures the prompt the way the browser draws it - a span carrying the
 * input's own computed font - and compares it with the input's content box.
 * A placeholder that does not fit is clipped, and neither `scrollWidth` nor a
 * screenshot diff will say so: placeholder text contributes nothing to either.
 */
const searchPromptFit = (page: Page) =>
  page.evaluate(() => {
    const input = document.querySelector('.DocsSearchInput') as HTMLInputElement;
    const style = getComputedStyle(input);
    const ruler = document.createElement('span');
    ruler.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    ruler.style.font = style.font;
    ruler.style.letterSpacing = style.letterSpacing;
    ruler.textContent = input.placeholder;
    document.body.append(ruler);
    const promptWidth = ruler.getBoundingClientRect().width;
    ruler.remove();

    return {
      promptWidth,
      contentWidth:
        input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      height: input.getBoundingClientRect().height,
      documentOverflows:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

test.describe('docs search on the narrowest supported screen', () => {
  test.use({ viewport: NARROW });

  test('shows the whole prompt without pushing the page sideways', async ({ page }) => {
    await openDocs(page);

    const fit = await searchPromptFit(page);
    expect(fit.promptWidth).toBeGreaterThan(0);
    expect(fit.contentWidth).toBeGreaterThanOrEqual(fit.promptWidth);
    expect(fit.documentOverflows).toBe(false);
    // The field moves to its own row; it must not have been shrunk to fit one.
    expect(fit.height).toBeGreaterThanOrEqual(32);
    await expect(page.getByLabel('Search the documentation')).toBeVisible();
  });
});

test.describe('docs header above the stacking width', () => {
  test.use({ viewport: { width: 600, height: 900 } });

  test('keeps the brand, title and search on one row', async ({ page }) => {
    await openDocs(page);

    const rows = await page.evaluate(() => {
      const top = (selector: string) =>
        Math.round(document.querySelector(selector)!.getBoundingClientRect().top);
      return { brand: top('.DocsTopBrand'), search: top('.DocsSearch') };
    });

    // Same row, so the narrow-width rule has not leaked upward. 600px is above
    // the 516px at which the bar first fits at its natural size.
    expect(Math.abs(rows.brand - rows.search)).toBeLessThan(20);
    // The spacer is an empty flex filler with no height, so `toBeVisible` is
    // the wrong question; what matters is that the narrow rule has not hidden it.
    await expect(page.locator('.DocsTopSpacer')).toHaveCSS('display', 'block');

    const fit = await searchPromptFit(page);
    expect(fit.contentWidth).toBeGreaterThanOrEqual(fit.promptWidth);
  });
});
