import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  countMismatchViolations,
  duplicateHeadingViolations,
  formatViolations,
  isReportableConsoleError,
  placeholderValueViolations,
  throttleDelayMs,
  rawEnumViolations,
  rawIdViolations,
  regressionsAgainstBaseline,
  staleForwardLookingViolations,
  type Violation,
} from './support/pageInvariants';
import {
  APP_ROUTE_PATTERN,
  LOGIN_PATH,
  getRequiredEnv,
  skipUnlessAuthSurfaceDeployed,
  submitSignIn,
  waitForRouteAwayFrom,
} from './support/auth';

/**
 * Walks every operational PIMS route and applies the same invariants to each.
 *
 * These surfaces had no end-to-end coverage of any kind. Defects visible in a
 * single screenshot - a raw PARENT_TASK enum, a database id shown to a vet, an
 * error message stacked on an empty state, one heading nested inside an
 * identically named one - shipped with a passing unit suite, because a fixture
 * the author wrote cannot contradict itself. One spec that reads the rendered
 * page catches the whole class, on every route, for the cost of one file.
 *
 * Credentials come from the environment, so this runs in the authenticated leg
 * (push to dev/main) and skips on a pull request, where secrets are correctly
 * withheld. That is a real limit: this catches a regression after merge, not
 * before it.
 */

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

/**
 * Read-only surfaces. Deliberately excludes the onboarding and creation wizards
 * (create-org, team-onboarding, stripe-onboarding, book-onboarding) - loading
 * those exercises flows that write, notify, or take payment.
 */
const ROUTES = [
  '/dashboard',
  '/appointments',
  '/tasks',
  '/chat',
  '/companions',
  '/inventory',
  '/controlled-substances',
  '/finance',
  '/finance/estimates',
  '/finance/discounts',
  '/finance/insurance-claims',
  '/organization',
  '/organization/specialities',
  '/settings',
  '/integrations',
  '/integrations/merck-manuals',
  '/organizations',
  '/appointments/idexx-workspace',
  '/forms',
  '/network',
  '/guides',
] as const;

const BASELINE_PATH = path.join(__dirname, 'route-sweep-baseline.json');

/**
 * The longest the sweep will wait for the rate-limit window. Slightly over the
 * limiter's own 15-minute window: anything beyond that is a malformed header,
 * not a wait.
 */
const MAX_THROTTLE_WAIT_MS = 16 * 60 * 1000;

const readBaseline = (): Record<string, string[]> => {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Record<string, string[]>;
  } catch {
    return {};
  }
};

/** Every visible, non-empty text node. Script and style content is not visible. */
export const visibleTexts = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const text = node.textContent?.trim() ?? '';
      if (text && parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
        // offsetParent is null for anything inside a display:none ancestor, and
        // getClientRects covers the position:fixed case offsetParent misses.
        // Checking the immediate parent's computed style is not enough: display
        // does not inherit, so a `hidden xl:hidden` responsive branch reports as
        // visible and its contents fail the sweep at a viewport that never
        // renders them.
        const rendered =
          parent.offsetParent !== null || parent.getClientRects().length > 0;
        const style = globalThis.getComputedStyle(parent);
        if (rendered && style.visibility !== 'hidden') out.push(text);
      }
      node = walker.nextNode();
    }
    return out;
  });

export const headingNames = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter((h) => (h as HTMLElement).offsetParent !== null)
      .map((h) => h.textContent?.trim() ?? '')
      .filter(Boolean)
  );

/**
 * Panels rendering an error message and an empty-state message at once.
 *
 * Matched on the copy both states actually use rather than on a class name: the
 * pairing is a product contradiction, and it must keep being caught when the
 * markup is restyled.
 */
export const contradictoryPanels = (page: Page) =>
  page.evaluate(() => {
    const ERROR = /could not load|unable to load|failed to load|try again/i;
    const EMPTY = /^no .+(yet|recorded|found|available)\.?$/i;
    const out: { name: string; hasError: boolean; hasEmptyState: boolean }[] = [];
    for (const section of document.querySelectorAll('section, [role="region"], article')) {
      const text = (section as HTMLElement).innerText ?? '';
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const hasError = lines.some((l) => ERROR.test(l));
      const hasEmptyState = lines.some((l) => EMPTY.test(l));
      if (hasError && hasEmptyState) {
        out.push({ name: lines[0]?.slice(0, 60) ?? 'unnamed section', hasError, hasEmptyState });
      }
    }
    return out;
  });

/**
 * The Inventory page states the same two quantities twice: a header summary and
 * the alert panels beneath it. They disagreed in production - "0 items below
 * reorder point" above a panel headed "Low stock 21" - because the header counted
 * only LOW_STOCK client-side while the panel used the server's
 * `onHand <= reorderLevel`, which includes zero.
 *
 * Reconciling them needs page knowledge, so it is scoped to this route rather
 * than dressed up as generic. A generic version was written first and called
 * nowhere, which is worse than not having it.
 */
export const inventoryCounts = (page: Page) =>
  page.evaluate(() => {
    const bodyText = document.body.innerText ?? '';
    const readSummary = (re: RegExp) => {
      const m = re.exec(bodyText);
      return m ? Number(m[1]) : undefined;
    };
    const panelCount = (title: string) => {
      for (const el of document.querySelectorAll('h2, h3, h4')) {
        if ((el.textContent ?? '').trim().toLowerCase() !== title) continue;
        const header = el.closest('div');
        const digits = /(\d+)/.exec(header?.textContent?.replace(el.textContent ?? '', '') ?? '');
        if (digits) return Number(digits[1]);
      }
      return undefined;
    };
    return {
      headerLowStock: readSummary(/(\d+)\s+items? below reorder point/i),
      panelLowStock: panelCount('low stock'),
    };
  });

/**
 * Rows under a heading that promises the future, with how far off each date is.
 * "Expiring soon" listed batches 222 days expired, because the alerts endpoint
 * bounds its window above and not below.
 */
export const forwardLookingRows = (page: Page) =>
  page.evaluate(() => {
    const out: { section: string; label: string; daysFromNow: number }[] = [];
    for (const el of document.querySelectorAll('h2, h3, h4')) {
      const section = (el.textContent ?? '').trim();
      if (!/soon|upcoming|next\b/i.test(section)) continue;
      const card = el.closest('div')?.parentElement;
      for (const row of card?.querySelectorAll('li') ?? []) {
        const text = (row as HTMLElement).innerText ?? '';
        // The UI renders relative days, which is the same thing the rule needs.
        const ago = /(\d+)\s+days?\s+ago/i.exec(text);
        const label = text.split('\n')[0]?.trim() ?? '';
        if (ago) out.push({ section, label, daysFromNow: -Number(ago[1]) });
      }
    }
    return out;
  });

export const documentOverflows = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

test.describe.configure({ mode: 'serial' });

test('every operational route holds its page invariants', async ({ page }) => {
  test.setTimeout(240_000);

  const email = getRequiredEnv('YC_E2E_EMAIL');
  const password = getRequiredEnv('YC_E2E_PASSWORD');
  if (!email || !password) return;

  /**
   * Listeners are attached per route rather than once, because a response still
   * in flight when the next navigation starts would otherwise be blamed on
   * whichever route happened to be current when it landed. The first run of this
   * spec attributed every late 5xx to /guides, the last route in the list.
   */
  /** Latest rate-limit budget the API reported, updated on every response. */
  const budget: { remaining?: number; resetAtMs?: number } = {};
  page.on('response', (r) => {
    const remaining = Number(r.headers()['ratelimit-remaining']);
    const resetSeconds = Number(r.headers()['ratelimit-reset']);
    if (Number.isFinite(remaining)) budget.remaining = remaining;
    if (Number.isFinite(resetSeconds)) budget.resetAtMs = Date.now() + resetSeconds * 1000;
  });

  const watchRoute = (route: string) => {
    const noise: string[] = [];
    const onConsole = (m: import('@playwright/test').ConsoleMessage) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (!isReportableConsoleError(text)) return;
      noise.push(`${route}  [console]  ${text.slice(0, 180)}`);
    };
    const onResponse = (r: import('@playwright/test').Response) => {
      // 5xx only. A 401/403/404 on a background probe is frequently intentional,
      // and a rule that fires on those trains people to ignore it.
      if (r.status() >= 500) noise.push(`${route}  [http]  ${r.status()} ${r.url().slice(0, 120)}`);
    };
    page.on('console', onConsole);
    page.on('response', onResponse);
    return () => {
      page.off('console', onConsole);
      page.off('response', onResponse);
      return noise;
    };
  };

  // Same probe the other authenticated specs run: a pre-cutover environment
  // skips, a 5xx auth surface fails loudly, and a failed probe is not silently
  // read as "not deployed".
  await skipUnlessAuthSurfaceDeployed();

  await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await submitSignIn(page, email, password);
  await waitForRouteAwayFrom(page, LOGIN_PATH);
  expect(new URL(page.url()).pathname).toMatch(APP_ROUTE_PATTERN);

  const baseline = readBaseline();
  const found: Record<string, string[]> = {};

  for (const [index, route] of ROUTES.entries()) {
    // Hold off only when the API says the budget is nearly spent, and then for
    // exactly as long as it says. A blind sleep between routes is slower than
    // needed while there is headroom and too short once there is not.
    const delay = throttleDelayMs({ ...budget, now: Date.now() });
    if (index > 0 && delay > 0) {
      // Wait the FULL reported reset. Capping this at 60s resumed navigation
      // inside a window that had not reset - the limiter's window is 15 minutes -
      // and because 429 console errors are suppressed, the remaining routes were
      // then evaluated against rate-limited error and empty states and passed.
      // A delay longer than the window itself means the header is wrong, and
      // that is a failure rather than something to sleep through.
      expect(
        delay,
        `The API reports ${Math.round(delay / 1000)}s until the rate-limit window resets, ` +
          'which is longer than the window itself. Refusing to continue: the remaining routes ' +
          'would be swept against throttled responses and would pass while proving nothing.'
      ).toBeLessThanOrEqual(MAX_THROTTLE_WAIT_MS);
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }
    const stopWatching = watchRoute(route);
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    // A route whose primary request hangs produces no HTTP response and not
    // necessarily a console error. Swallowing this timeout let the sweep read a
    // page still showing its loading skeleton, find no violations, and report an
    // unusable route as healthy.
    const settled = await page
      .waitForLoadState('networkidle', { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (!settled) {
      found[route] = [
        `${route}  [never-settled]  still loading after 30s; the page was not swept`,
      ];
      stopWatching();
      continue;
    }

    // The main document's own status, kept separate from the background-probe
    // listener that deliberately ignores 404s. A deleted or mistyped route can
    // return 404 while leaving the pathname unchanged, and the not-found page
    // satisfies every text invariant - passing the sweep while the route is
    // broken.
    const status = response?.status();
    if (status !== undefined && status >= 400) {
      found[route] = [`${route}  [not-reachable]  the page itself returned ${status}`];
      stopWatching();
      continue;
    }

    // A route the account cannot reach is not swept, and reporting zero
    // violations for it would be a false pass. This covers more than sign-in:
    // when the account lacks a permission, OrgGuard redirects to the first
    // accessible app route, and the sweep would otherwise analyse that fallback
    // page under the requested route's name.
    const landed = new URL(page.url()).pathname;
    if (landed !== route) {
      found[route] = [`${route}  [not-reachable]  redirected to ${landed}`];
      stopWatching();
      continue;
    }

    const [texts, headings, panels, overflow] = await Promise.all([
      visibleTexts(page),
      headingNames(page),
      contradictoryPanels(page),
      documentOverflows(page),
    ]);

    // Route-specific invariants, run only where the pairing exists.
    const targeted: Violation[] = [];
    if (route === '/inventory') {
      const counts = await inventoryCounts(page);
      if (counts.headerLowStock !== undefined && counts.panelLowStock !== undefined) {
        targeted.push(
          ...countMismatchViolations([
            {
              label: 'items below reorder point',
              sources: [
                { where: 'page header', value: counts.headerLowStock },
                { where: 'Low stock panel', value: counts.panelLowStock },
              ],
            },
          ])
        );
      }
      targeted.push(...staleForwardLookingViolations(await forwardLookingRows(page)));
    }

    const violations: Violation[] = [
      ...targeted,
      ...rawEnumViolations(texts),
      ...rawIdViolations(texts),
      ...placeholderValueViolations(texts),
      ...duplicateHeadingViolations(headings),
      ...panels.map((p) => ({
        rule: 'error-and-empty-together',
        detail: `${p.name} renders an error and an empty state at once`,
      })),
      ...(overflow ? [{ rule: 'document-overflow', detail: 'the page scrolls horizontally' }] : []),
    ];

    const lines = [
      ...formatViolations(route, violations).split('\n').filter(Boolean),
      // Deduplicated: one failing endpoint retried by a hook produces the same
      // line twenty times, which buries every other finding.
      ...new Set(stopWatching()),
    ];
    if (lines.length) found[route] = lines;
  }

  if (process.env.UPDATE_ROUTE_SWEEP_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(found, null, 2)}\n`);
    test.info().annotations.push({ type: 'baseline', description: 'baseline rewritten' });
    return;
  }

  // Fail only on what the baseline does not already record. Existing debt is
  // visible in the file and shrinks by deletion; anything new fails today.
  const regressions = Object.entries(found).flatMap(([route, lines]) =>
    regressionsAgainstBaseline(lines, baseline[route] ?? [])
  );

  expect(regressions, `New page-invariant violations:\n${regressions.join('\n')}`).toEqual([]);
});
