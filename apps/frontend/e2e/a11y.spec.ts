import { type Page, expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * 90s, not the 30s default.
 *
 * An axe pass is CPU-heavy, and this file now runs thirteen of them against a
 * single Next dev server. CI serialises them (`workers: 1`), but a local run is
 * fullyParallel, and adding the six public-page tests was enough to push the
 * sign-in and sign-up runs past 30s on a warm laptop - they pass in 6s and 4s
 * serialised. Raising the ceiling keeps the local run honest instead of
 * intermittently red for a reason that has nothing to do with accessibility.
 */
test.describe.configure({ timeout: 90_000 });

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21aa'];

/**
 * WCAG 2.1 AA, minus colour-contrast.
 *
 * The original comment here said colour-contrast was excluded "because headless
 * Chrome does not compute computed colour styles reliably". That is not true -
 * see `runAxeWithContrast` below, which relies on it working, and does. The real
 * reason the rule stays off for the marketing pages is less flattering: `/` and
 * `/pricing` currently fail it 26 times in light and 16 in dark, worst 1.94:1.
 * Turning it on for them would make this suite red on arrival, so that debt is
 * tracked separately rather than hidden behind a wrong explanation.
 */
const runAxe = (page: Page) =>
  new AxeBuilder({ page }).withTags(WCAG_AA).disableRules(['color-contrast']).analyze();

/**
 * The full AA set, colour-contrast included.
 *
 * Verified working in this exact environment: given a 2.1:1 pair and an 18:1
 * pair on one page, headless Chromium reports the first as a violation, the
 * second as a pass, and neither as incomplete.
 *
 * Used for the three public pages a stranger is most likely to be sent a link
 * to, and which carry the most personal data. Every one of them shipped a
 * contrast defect that this suite could not see: 10 of 56 nodes below AA on
 * /book, an expired-rabies badge at 1.89:1 on /passport, and owner and medical
 * details at 2.40:1 on /card. All three were found by hand while CI stayed
 * green.
 */
const runAxeWithContrast = (page: Page) => new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

// Public pages pull logos/data from third-party hosts (GitHub API, CloudFront,
// laika.aitemsolutions.com, unsplash, wikimedia). When any of those is slow or
// unreachable from CI the request stays in flight and `networkidle` never settles,
// timing out the axe run. These accessibility checks only care about the app's own
// markup, so abort every cross-origin request and let the page reach idle reliably.
const blockCrossOriginRequests = async (page: Page) => {
  await page.route('**/*', (route) => {
    const requestUrl = route.request().url();
    const isSameOrigin =
      requestUrl.startsWith('http://127.0.0.1:3001') ||
      requestUrl.startsWith('http://localhost:3001') ||
      requestUrl.startsWith('data:') ||
      requestUrl.startsWith('blob:');
    if (isSameOrigin) return route.continue();
    return route.abort();
  });
};

test.describe('Public pages — accessibility (WCAG 2.1 AA)', () => {
  test.beforeEach(async ({ page }) => {
    await blockCrossOriginRequests(page);
  });

  test('home / marketing page has no axe violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await runAxe(page);
    expect(results.violations).toEqual([]);
  });

  test('sign-in page has no axe violations', async ({ page }) => {
    await page.goto('/signin');
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await runAxe(page);
    expect(results.violations).toEqual([]);
  });

  test('sign-up page has no axe violations', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await runAxe(page);
    expect(results.violations).toEqual([]);
  });

  test('pricing page has no axe violations', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await runAxe(page);
    expect(results.violations).toEqual([]);
  });

  test('skip link is reachable via keyboard on every page', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('focus does not get trapped outside interactive elements on home', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // After two tabs the focus should have moved away from the skip link
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).not.toBeFocused();
  });
});

/**
 * The three public pages a link gets sent to.
 *
 * These are the highest-stakes surfaces in the product for accessibility: the
 * reader is signed out, usually on a phone that is not theirs to configure, and
 * is being asked for personal details or shown a health record. They were also
 * the three pages this suite did not cover.
 *
 * Two things make these tests different from the marketing ones above, and both
 * are deliberate:
 *
 * 1. They run colour-contrast. See runAxeWithContrast.
 * 2. They assert the page actually RENDERED before trusting a clean axe run.
 *    Without that, an aborted or stubbed-wrong API drops each page into its
 *    "not found" state - which is a handful of nodes that legitimately pass, so
 *    a broken fixture reads exactly like a green result. That is not
 *    hypothetical: a first pass at this reported "0 violations" while checking
 *    0 text nodes.
 */
const PASSPORT_FIXTURE = {
  passportNumber: 'PT-E2E-0001',
  identity: {
    id: 'e2e-1',
    name: 'Luna',
    breed: 'Beagle',
    species: 'dog',
    sex: 'FEMALE',
    dateOfBirth: '2021-03-14',
    colour: 'Tricolour',
    distinguishingMarks: 'White blaze',
    photoUrl: null,
  },
  owner: { name: 'Marta Ferreira', email: 'marta@example.com', phone: '+351 912 000 111' },
  microchip: {
    number: '941000024681357',
    implantedAt: '2021-05-02',
    location: 'Left side of neck',
  },
  // Deliberately expired: the expired badge is the element that shipped at
  // 1.89:1, so the fixture has to render it.
  rabies: {
    id: 'r1',
    vaccineName: 'Nobivac Rabies',
    dateAdministered: '2022-06-11',
    validUntil: '2024-06-11',
    batchNumber: 'RB-2022-118',
  },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [
    { id: 'e1', fitForTravel: true, examinedAt: '2026-03-01', examiningVetName: 'Dr Alves' },
  ],
};

const CARD_FIXTURE = {
  audience: 'PUBLIC',
  identity: { id: 'e2e-c1', name: 'Luna', type: 'dog', breed: 'Beagle', photoUrl: null },
  // Alerts are what carry the fill that shipped at 2.40:1 on a pinned card.
  alerts: [{ id: 'a1', severity: 'medium', title: 'Allergic to penicillin' }],
  ownerContact: { firstName: 'Marta', lastName: 'Ferreira', phoneNumber: '+351 912 000 111' },
  medical: { bloodGroup: 'DEA 1.1 negative' },
};

/**
 * Fulfil the public API rather than aborting it.
 *
 * `blockCrossOriginRequests` aborts everything off-origin, which is right for
 * the marketing pages and fatal here - the API these pages read is cross-origin,
 * so aborting it renders the not-found state instead of the page under test.
 */
const stubPublicApi = async (page: Page) => {
  await page.route(
    (url) => /\/public\/(pet-passport\/token|companion-card|booking)\//.test(url.href),
    (route) => {
      const url = route.request().url();
      if (url.includes('/pet-passport/token/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(PASSPORT_FIXTURE),
        });
      }
      if (url.includes('/companion-card/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(CARD_FIXTURE),
        });
      }
      return route.abort();
    }
  );
};

/**
 * The warm-bone surface in each theme, read back off the element to prove a
 * toggle actually repainted rather than only updating React state.
 */
const WARM_BONE_LIGHT_SCREEN = '#f7f3ec';
const WARM_BONE_DARK_SCREEN = '#2f271e';

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Shared public pages — accessibility, ${theme} (WCAG 2.1 AA incl. contrast)`, () => {
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ page }) => {
      await blockCrossOriginRequests(page);
      await stubPublicApi(page);
    });

    test(`the shared pet passport has no axe violations in ${theme}`, async ({ page }) => {
      await page.goto('/passport/e2e-a11y');
      await page.waitForLoadState('networkidle').catch(() => {});
      // The content floor: the passport rendered, not its not-found state.
      await expect(page.getByText('Luna')).toBeVisible();
      await expect(page.getByText(/expired/i).first()).toBeVisible();

      const results = await runAxeWithContrast(page);
      expect(results.violations).toEqual([]);
    });

    test(`the passport survives its own theme toggle in ${theme}`, async ({ page }) => {
      // The branch the other test cannot reach. #2578 keyed the warm-bone
      // overrides on DISAGREEMENT: they apply only when the reader has pushed
      // this page away from the root theme. Setting the OS scheme alone always
      // leaves the two in agreement, so both new selectors - and every token
      // inside them - stay unexercised, and a broken one would leave the suite
      // green.
      await page.goto('/passport/e2e-a11y');
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page.getByText('Luna')).toBeVisible();

      // Before the toggle the attribute is absent: the page follows the root.
      const main = page.locator('main.yc-warmbone');
      await expect(main).not.toHaveAttribute('data-wb-theme', /.*/);

      await page.getByRole('button', { name: /toggle light or dark theme/i }).click();

      // Now it disagrees with the root, which is the only state that activates
      // the overrides.
      await expect(main).toHaveAttribute('data-wb-theme', theme === 'dark' ? 'light' : 'dark');

      // The attribute alone proves only that React updated its state. If either
      // disagreement selector is broken or renamed, the attribute still flips,
      // the override simply never applies, and the page sits in the perfectly
      // valid root theme - where axe passes and the regression goes unseen.
      // Verified by renaming both selectors: the attribute assertion stayed
      // green. So assert the PALETTE repainted, which is what they exist to do.
      const surface = await main.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--screen').trim()
      );
      expect(surface).toBe(theme === 'dark' ? WARM_BONE_LIGHT_SCREEN : WARM_BONE_DARK_SCREEN);

      await expect(page.getByText(/expired/i).first()).toBeVisible();

      const results = await runAxeWithContrast(page);
      expect(results.violations).toEqual([]);
    });

    test(`the shared companion card has no axe violations in ${theme}`, async ({ page }) => {
      await page.goto('/card/e2e-a11y');
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page.getByText('Luna')).toBeVisible();
      await expect(page.getByText('Allergic to penicillin')).toBeVisible();

      const results = await runAxeWithContrast(page);
      expect(results.violations).toEqual([]);
    });

    test(`the unavailable booking page has no axe violations in ${theme}`, async ({ page }) => {
      // The populated booking page needs a live practice, which this suite has
      // no fixture for; smoke.spec.ts uses the same unknown slug. The
      // unavailable state is still worth covering - it is a real page a reader
      // reaches from a revoked link, and it exercises the (book) layout, the
      // card surface and the footer.
      await page.goto('/book/no-such-practice-e2e');
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(
        page.getByRole('heading', { name: /this booking page is not available/i })
      ).toBeVisible();

      const results = await runAxeWithContrast(page);
      expect(results.violations).toEqual([]);
    });
  });
}

test.describe('Sign-in page — form accessibility', () => {
  test('email and password inputs have accessible labels', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /show password/i })).toBeVisible();
  });
});
