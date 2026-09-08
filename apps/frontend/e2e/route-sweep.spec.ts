import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  duplicateHeadingViolations,
  formatViolations,
  isReportableConsoleError,
  placeholderValueViolations,
  throttleDelayMs,
  rawEnumViolations,
  rawIdViolations,
  type Violation,
} from './support/pageInvariants';
import {
  APP_ROUTE_PATTERN,
  LOGIN_PATH,
  getRequiredEnv,
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
  '/companions/history',
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
  '/forms',
  '/network',
  '/guides',
] as const;

const BASELINE_PATH = path.join(__dirname, 'route-sweep-baseline.json');

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
        const style = globalThis.getComputedStyle(parent);
        if (style.display !== 'none' && style.visibility !== 'hidden') out.push(text);
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
      await new Promise((resolve) => {
        setTimeout(resolve, Math.min(delay, 60_000));
      });
    }
    const stopWatching = watchRoute(route);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    // A route that bounced to sign-in was not swept, and reporting zero
    // violations for it would be a false pass.
    const landed = new URL(page.url()).pathname;
    if (/signin|login/.test(landed)) {
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

    const violations: Violation[] = [
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
    lines.filter((l) => !(baseline[route] ?? []).includes(l))
  );

  expect(regressions, `New page-invariant violations:\n${regressions.join('\n')}`).toEqual([]);
});
