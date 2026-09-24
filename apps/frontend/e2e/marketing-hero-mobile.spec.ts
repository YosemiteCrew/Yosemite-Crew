import { type Page, expect, test } from '@playwright/test';

/**
 * The marketing hero grids at a phone width.
 *
 * `[data-grid-1-m]` collapses the two-column marketing heroes to one column
 * below 900px. It used to do that with a bare `1fr`, which keeps the implicit
 * `auto` minimum: the track cannot shrink below the widest item's minimum
 * contribution, so the Insights live console held the single track at 532px
 * inside a 342px container and the `h1` and lead paragraph stretched with it.
 * The section's `overflow: hidden` then cut the text off with no scrollbar, so
 * nothing on the page announced the defect.
 *
 * That is why `document.scrollWidth <= innerWidth` — the guard the Insights
 * story already carries — could not see this: the overflow was contained, not
 * absent. These assertions measure against the grid's own box instead.
 *
 * Every assertion names the viewport it holds at and is paired with a desktop
 * reading that must not change, because the fix is scoped to a media query and
 * a phone-only test cannot tell a scoped fix from one that rewrote the wide
 * layout.
 */

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

/* Fonts matter: every width measured here is a text-fit question, and a
   fallback face wraps differently from Newsreader. The hero copy is static, so
   `domcontentloaded` plus fonts is enough - the GitHub stat fetches fill the
   console later and none of the assertions below wait on them. */
const openInsights = async (page: Page) => {
  await page.goto('/insights', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('h1')).toBeVisible();
};

test.describe('marketing hero grids at a phone width', () => {
  test.use({ viewport: PHONE });

  /*
   * A witness, not the gate. Measured: with the rule reverted to a bare `1fr`
   * this case still passed locally, because `next dev` served the console
   * before its GitHub fetches resolved and a narrow console never widens the
   * track. The assertions are right; the fixture just cannot be relied on to
   * carry the trigger. The gate is the planted-item case below, which killed
   * that same revert (track 2782.62 against a 342px container).
   */
  test('keep the Insights hero copy inside the container that clips it', async ({ page }) => {
    await openInsights(page);

    const hero = await page.evaluate(() => {
      const heading = document.querySelector('h1') as HTMLElement;
      const grid = heading.closest('[data-grid-1-m]') as HTMLElement;
      const lead = heading.parentElement?.querySelector('p') as HTMLElement;
      const edge = grid.getBoundingClientRect().right;
      return {
        gridWidth: grid.getBoundingClientRect().width,
        trackWidth: Number.parseFloat(getComputedStyle(grid).gridTemplateColumns),
        headingOverhang: heading.getBoundingClientRect().right - edge,
        leadOverhang: lead.getBoundingClientRect().right - edge,
      };
    });

    /* One track below 900px. Asserted as a width rather than a count because a
       count cannot tell a track that fits from one that has blown out. */
    expect(hero.trackWidth).toBeLessThanOrEqual(hero.gridWidth);
    expect(hero.headingOverhang).toBeLessThanOrEqual(0);
    expect(hero.leadOverhang).toBeLessThanOrEqual(0);
  });

  test('hold a one-column track at the container width whatever it contains', async ({ page }) => {
    await openInsights(page);

    /*
     * The control, and the reason this file is not hostage to the live console.
     *
     * The assertion above is only as strong as whatever the hero happens to
     * contain, and that is not hypothetical: reverted to a bare `1fr` it passed
     * against a console that had not finished its GitHub fetches. A narrow
     * console never widens the track, so nothing overflowed and the case was
     * pinning nothing.
     *
     * So plant an item wider than the container and read the track twice: once
     * under the rule as shipped, once under the bare `1fr` it replaced. The
     * second reading is what the defect looked like. If a later edit reverts
     * the rule, `shipped` fails; if this mechanism stops applying at all, the
     * two readings converge and `reverted` fails. Neither arm can go quiet on
     * its own.
     */
    const tracks = await page.evaluate(() => {
      const grid = (document.querySelector('h1') as HTMLElement).closest(
        '[data-grid-1-m]'
      ) as HTMLElement;

      const plant = document.createElement('div');
      /* An unbreakable run, so its minimum contribution is its full width and
         no wrapping opportunity can soften it. */
      plant.textContent = 'x'.repeat(400);
      plant.style.whiteSpace = 'nowrap';
      grid.appendChild(plant);

      const read = () => ({
        container: grid.getBoundingClientRect().width,
        track: Number.parseFloat(getComputedStyle(grid).gridTemplateColumns),
      });

      const shipped = read();

      const revert = document.createElement('style');
      revert.textContent =
        '@media (max-width: 900px){[data-grid-1-m]{grid-template-columns:1fr !important}}';
      document.head.appendChild(revert);
      const reverted = read();
      revert.remove();

      plant.remove();
      return { shipped, reverted };
    });

    expect(tracks.shipped.track).toBeLessThanOrEqual(tracks.shipped.container);
    expect(tracks.reverted.track).toBeGreaterThan(tracks.reverted.container);
  });
});

test.describe('marketing hero grids on a desktop viewport', () => {
  test.use({ viewport: DESKTOP });

  test('keep the Insights hero in two columns', async ({ page }) => {
    await openInsights(page);

    /* The desktop half. `minmax(0, 1fr)` is scoped inside the 900px media
       query, so the wide layout must read exactly as it did before: two
       tracks, from the component's own `1.02fr 0.98fr`. */
    const trackCount = await page.evaluate(() => {
      const grid = (document.querySelector('h1') as HTMLElement).closest(
        '[data-grid-1-m]'
      ) as HTMLElement;
      return getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
    });

    expect(trackCount).toBe(2);
  });
});
