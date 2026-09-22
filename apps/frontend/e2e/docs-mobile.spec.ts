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
  await page.goto('/docs', { waitUntil: 'domcontentloaded' });
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

const navMenu = (page: Page) => page.getByRole('button', { name: 'Documentation menu' });
const navTree = (page: Page) => page.locator('#docs-nav-tree');
const docsTitleTop = (page: Page) =>
  page.locator('.DocsTitle').evaluate((el) => el.getBoundingClientRect().top);

test.describe('collapsed docs navigation at a phone width', () => {
  test.use({ viewport: PHONE });

  test('keeps the article on the first screen instead of below the whole tree', async ({
    page,
  }) => {
    await openDocs(page);

    const toggle = navMenu(page);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-controls', 'docs-nav-tree');
    await expect(navTree(page)).toBeHidden();
    // In flow rather than pinned: sticky here would cover the article instead.
    await expect(page.locator('.DocsNav')).toHaveCSS('position', 'static');

    /*
     * The control, and the only part that measures the reported defect. That
     * the tree is collapsed says nothing about where the reader lands, and a
     * nav that had shrunk to a handful of links would satisfy the assertion
     * above with nothing left to prove. Forcing `data-open` in the page gives
     * the pre-fix reading from this same render, so the two numbers differ by
     * the height the disclosure actually removes.
     */
    const collapsedTop = await docsTitleTop(page);
    await navTree(page).evaluate((el) => el.setAttribute('data-open', 'true'));
    const expandedTop = await docsTitleTop(page);
    await navTree(page).evaluate((el) => el.setAttribute('data-open', 'false'));

    expect(collapsedTop).toBeLessThan(PHONE.height);
    expect(expandedTop).toBeGreaterThan(PHONE.height);
  });

  test('opens from the keyboard with its links reachable', async ({ page }) => {
    await openDocs(page);

    const toggle = navMenu(page);
    await toggle.focus();
    await page.keyboard.press('Enter');

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(navTree(page)).toBeVisible();

    const firstLink = navTree(page).getByRole('link').first();
    await expect(firstLink).toBeVisible();
    await expect(firstLink).toHaveAttribute('href', /^\/docs/);
    await firstLink.focus();
    await expect(firstLink).toBeFocused();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(navTree(page)).toBeHidden();
  });
});

/*
 * The no-JavaScript floor, and the arm that was missing when #3488 shipped.
 *
 * This measures COMPUTED STYLE, not visibility, and that is not a shortcut.
 * With scripting off nothing on this site paints at all: every route segment
 * sits behind the Suspense boundary that `src/app/loading.tsx` installs, so the
 * whole document arrives inside `<div hidden id="S:0">` and is swapped into
 * place by an inline script that never runs. `toBeVisible` therefore answers
 * "hidden" for `.DocsTopBar`, the article and the nav alike, on every page,
 * fixed or not - it cannot see this defect and cannot see it being fixed.
 * That is YosemiteCrew/Yosemite-Crew#3510, and it is a separate change.
 *
 * `display: none` on an ancestor does not change a descendant's own computed
 * `display`, so the cascade below is fully readable through it - and it is
 * exactly what the disclosure is built out of. When #3510 lands, promote these
 * to `toBeVisible` / `toBeHidden`.
 */
test.describe('docs navigation at a phone width with JavaScript disabled', () => {
  test.use({ viewport: PHONE, javaScriptEnabled: false });

  const cascade = (page: Page) =>
    page.evaluate(() => {
      const shown = (selector: string) =>
        getComputedStyle(document.querySelector(selector)!).display;
      const tree = document.querySelector('#docs-nav-tree')!;
      /* The body of a section declared `collapsed`. Read by attribute rather
         than by id so it follows `docsNav.ts` instead of pinning a label. */
      const section = () => {
        const body = tree.querySelector('[data-expanded="false"]');
        return body === null
          ? { sectionDisplay: null, sectionLinks: 0 }
          : {
              sectionDisplay: getComputedStyle(body).display,
              sectionLinks: body.querySelectorAll('a').length,
            };
      };
      return {
        toggle: shown('.DocsNavToggle'),
        tree: shown('#docs-nav-tree'),
        dataOpen: tree.getAttribute('data-open'),
        /* `locator('a')` rather than a role query: a section declared
           `collapsed` is closed with `display: none`, which takes its links
           out of the accessibility tree, so a role query cannot count them. */
        links: tree.querySelectorAll('a').length,
        ...section(),
      };
    });

  test('resolves the tree open and the dead disclosure away', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#docs-nav-tree')).toHaveCount(1);

    const state = await cascade(page);

    /*
     * The premise. The served state is still the collapsed one - the override
     * is a stylesheet, not a different render, and that is the whole point:
     * serving it open would flash the tree above the article on every phone
     * load with JavaScript on. If this ever reads "true", the assertions below
     * have stopped testing the case they were written for.
     */
    expect(state.dataOpen).toBe('false');
    expect(state.links).toBeGreaterThan(0);

    // The media query hid this tree; without the override it computes to none.
    expect(state.tree).toBe('block');
    // A button whose only behaviour is an onClick handler must not be offered.
    expect(state.toggle).toBe('none');
  });

  /*
   * The collapsed section, which is the largest part of the tree and the one
   * thing a scripting-off reader could never open. The override only reaches
   * it because `docs.css` closes the body with an ordinary unlayered rule -
   * so this is the assertion that fails if that rule is ever given `!important`
   * or moved into a layer, and the one that fails if its selector stops
   * matching the served DOM at all.
   */
  test('resolves a collapsed section open, links and all', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#docs-nav-tree')).toHaveCount(1);

    const state = await cascade(page);

    // The premise: the served state is still the collapsed one.
    expect(state.sectionLinks).toBeGreaterThan(0);
    expect(state.sectionDisplay).toBe('block');
  });
});

/*
 * The other side of the same rule. With scripting on, that section must still
 * be shut on arrival - the override lives in `<noscript>`, which a running
 * browser ignores. Without this, a collapse rule whose selector had quietly
 * stopped matching would read as a pass above and break nothing here.
 */
test.describe('docs navigation with JavaScript enabled', () => {
  test.use({ viewport: DESKTOP });

  test('keeps a section declared collapsed shut on arrival', async ({ page }) => {
    await openDocs(page);

    const state = await page.evaluate(() => {
      const body = document.querySelector('#docs-nav-tree [data-expanded="false"]');
      return body === null
        ? { display: null, links: 0 }
        : { display: getComputedStyle(body).display, links: body.querySelectorAll('a').length };
    });

    expect(state.links).toBeGreaterThan(0);
    expect(state.display).toBe('none');
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

  /*
   * The desktop half of the phone disclosure. The tree is hidden by a media
   * query keyed on `data-open`, not by the component, so the rail here must be
   * visible while the client state behind it is still the collapsed one.
   */
  test('shows the whole tree with no disclosure to press', async ({ page }) => {
    await openDocs(page);

    await expect(navMenu(page)).toBeHidden();
    await expect(navTree(page)).toBeVisible();
    await expect(navTree(page)).toHaveAttribute('data-open', 'false');
    await expect(navTree(page).getByRole('link').first()).toBeVisible();
  });
});

for (const viewport of [NARROW, { width: 1024, height: 800 }, DESKTOP]) {
  test.describe(`docs table of contents at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('shows keyboard-operable compact navigation only below the desktop breakpoint', async ({
      page,
    }) => {
      await openDocs(page);

      const compactToc = page.locator('.DocsTocCompact');
      const desktopToc = page.locator('.DocsToc');

      if (viewport.width <= 1180) {
        await expect(compactToc).toBeVisible();
        await expect(desktopToc).toBeHidden();
        await expect(compactToc).not.toHaveAttribute('open');

        const summary = compactToc.locator('summary');
        await summary.focus();
        await expect(summary).toBeFocused();
        await summary.press('Enter');
        await expect(compactToc).toHaveAttribute('open', '');

        const prerequisiteLink = compactToc.locator('a[href="#prerequisites"]');
        await expect(prerequisiteLink).toBeVisible();
        await prerequisiteLink.click();
        await expect(page).toHaveURL(/#prerequisites$/);
      } else {
        await expect(compactToc).toBeHidden();
        await expect(desktopToc).toBeVisible();
      }
    });
  });
}

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
