import { expect, test, type Page } from '@playwright/test';
import {
  contradictoryPanels,
  documentOverflows,
  forwardLookingRows,
  headingNames,
  inventoryCounts,
  resolveCompanionOverview,
  visibleTexts,
} from './route-sweep.spec';

/**
 * The extractors run inside the browser, so the pure checkers passing proves
 * nothing about them. This drives real DOM built from the defects observed on
 * the deployed app - no login required, so it runs on every pull request while
 * the sweep itself can only run where credentials exist.
 */

const PATIENT_OVERVIEW = `
  <section>
    <h3>Problem list</h3>
    <div role="alert">Could not load the problem list. Please try again.</div>
    <p>No problems recorded for this patient yet.</p>
  </section>
  <section>
    <h3>Patient flags</h3>
    <p>No active flags for this patient.</p>
  </section>
  <p>Patient ID: 6971e5d25934bff94ee07942</p>
  <p>MEDICATION • PARENT_TASK</p>
  <p style="display:none">HIDDEN_ENUM</p>
`;

test('collects only visible text', async ({ page }) => {
  await page.setContent(PATIENT_OVERVIEW);
  const texts = await visibleTexts(page);
  expect(texts.join(' ')).toContain('PARENT_TASK');
  // A display:none node is not a defect a user can see, and counting it would
  // make the rule fire on things nobody can act on.
  expect(texts.join(' ')).not.toContain('HIDDEN_ENUM');
});

test('finds the panel showing an error and an empty state at once', async ({ page }) => {
  await page.setContent(PATIENT_OVERVIEW);
  const panels = await contradictoryPanels(page);
  expect(panels).toHaveLength(1);
  expect(panels[0].name).toContain('Problem list');
});

test('does not flag a panel showing only an empty state', async ({ page }) => {
  await page.setContent(
    `<section><h3>Patient flags</h3><p>No active flags for this patient.</p></section>`
  );
  expect(await contradictoryPanels(page)).toHaveLength(0);
});

test('reads visible headings, including a nested duplicate', async ({ page }) => {
  await page.setContent(`
    <h2>Front desk</h2>
    <section><h3>Check-in board</h3><section><h4>Check-in board</h4></section></section>
    <h3 style="display:none">Hidden heading</h3>
  `);
  const headings = await headingNames(page);
  expect(headings).toEqual(['Front desk', 'Check-in board', 'Check-in board']);
});

test('detects horizontal document overflow, and its absence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(`<div style="width:1400px">wide</div>`);
  expect(await documentOverflows(page)).toBe(true);

  await page.setContent(`<div style="width:100%">narrow</div>`);
  expect(await documentOverflows(page)).toBe(false);
});

test('does not collect text hidden by an ANCESTOR', async ({ page }) => {
  // display does not inherit, so checking only the immediate parent's computed
  // style treats a responsive branch under `hidden` as visible, and its contents
  // fail the sweep at a viewport that never renders them.
  await page.setContent(`
    <div style="display:none"><div><span>HIDDEN_BY_ANCESTOR</span></div></div>
    <div><span>VISIBLE_TEXT</span></div>
  `);
  const texts = await visibleTexts(page);
  expect(texts.join(' ')).toContain('VISIBLE_TEXT');
  expect(texts.join(' ')).not.toContain('HIDDEN_BY_ANCESTOR');
});

test('reconciles the Inventory header against its Low stock panel', async ({ page }) => {
  // The production screen: header says 0, the panel beneath says 21.
  await page.setContent(`
    <p>0 items below reorder point &bull; 15 expired batches</p>
    <div><h3>Low stock</h3><span>21</span></div>
  `);
  expect(await inventoryCounts(page)).toEqual({ headerLowStock: 0, panelLowStock: 21 });
});

test('finds past-dated rows under a forward-looking heading', async ({ page }) => {
  await page.setContent(`
    <div>
      <div><h3>Expiring soon</h3><span>51</span></div>
      <ul><li>dsdsd
222 DAYS AGO</li><li>fresh batch
in 30 days</li></ul>
    </div>
  `);
  const rows = await forwardLookingRows(page);
  expect(rows).toHaveLength(1);
  expect(rows[0].daysFromNow).toBe(-222);
  expect(rows[0].section).toBe('Expiring soon');
});

/*
 * The companions list reaches the overview through a row menu that calls
 * router.push, so the fixture is served from a real origin: a pushState needs
 * one, and setContent's about:blank has none.
 */
const ORIGIN = 'http://route-sweep.test';
const serveAt = async (page: Page, pathname: string, body: string) => {
  await page.route(`${ORIGIN}${pathname}`, (route) =>
    route.fulfill({ contentType: 'text/html', body: `<!doctype html><body>${body}</body>` })
  );
  await page.goto(`${ORIGIN}${pathname}`);
};
const serveCompanions = (page: Page, body: string) => serveAt(page, '/companions', body);
const MENU_ITEMS = (openOverview: string) => `
  <button role="menuitem">Add task</button>
  <button role="menuitem" onclick="${openOverview}">Open overview</button>
`;
const ROW_MENU = (openOverview: string, items = MENU_ITEMS(openOverview)) => `
  <p style="display:none">No patients yet</p>
  <button aria-label="Patient row actions" onclick="document.getElementById('menu').hidden = false">
    More
  </button>
  <div id="menu" role="menu" hidden>${items}</div>
`;

test('opens the first companion overview from its row menu and returns its address', async ({
  page,
}) => {
  await serveCompanions(
    page,
    ROW_MENU(
      "history.pushState({}, '', '/companions/history?companionId=abc123&amp;source=companions')"
    )
  );
  expect(await resolveCompanionOverview(page, 2_000)).toEqual({
    href: '/companions/history?companionId=abc123&source=companions',
  });
});

test('reports an overview action that goes nowhere instead of sweeping /companions', async ({
  page,
}) => {
  // Opening a history URL without an id renders a stub, so it must not count.
  await serveCompanions(page, ROW_MENU("history.pushState({}, '', '/companions/history')"));
  expect(await resolveCompanionOverview(page, 2_000)).toEqual({
    unreachable: '"Open overview" on the first companion did not open the overview',
  });
});

test('reports an org with no companions as unswept, not as a pass', async ({ page }) => {
  // Each layout renders its own empty state; the hidden copies must not be
  // what the lookup waits on.
  await serveCompanions(page, `<p style="display:none">No patients yet</p><p>No patients yet</p>`);
  expect(await resolveCompanionOverview(page, 2_000, 500)).toEqual({
    unreachable: 'no companion is listed on /companions, so there is no overview to open',
  });
});

test('reports a companions page that never finished rendering', async ({ page }) => {
  await serveCompanions(page, `<div class="animate-pulse">Loading</div>`);
  expect(await resolveCompanionOverview(page, 1_000)).toEqual({
    unreachable: '/companions rendered neither a companion nor its empty state',
  });
});

test('waits out the empty state the list shows before its companions arrive', async ({ page }) => {
  // The list has no loading state, so a slow load reads as an empty org at first.
  const rows = ROW_MENU(
    "history.pushState({}, '', '/companions/history?companionId=abc123&amp;source=companions')"
  );
  await serveCompanions(
    page,
    `<p>No patients yet</p>
     <script>setTimeout(() => { document.body.innerHTML = ${JSON.stringify(rows)}; }, 500);</script>`
  );
  expect(await resolveCompanionOverview(page, 2_000, 3_000)).toEqual({
    href: '/companions/history?companionId=abc123&source=companions',
  });
});

test('reports a row menu without "Open overview" by name, not as a timeout', async ({ page }) => {
  await serveCompanions(page, ROW_MENU('', '<button role="menuitem">Add task</button>'));
  expect(await resolveCompanionOverview(page, 1_000, 500)).toEqual({
    unreachable: 'the first companion\'s row menu offered no "Open overview"',
  });
});

test('names the redirect at once when /companions was left before the lookup', async ({ page }) => {
  // What an unverified org's owner gets: the guard sends /companions to the
  // dashboard. Nothing there is the list, so there is nothing to wait for.
  await serveAt(page, '/dashboard', '<p>Good morning</p>');
  const started = Date.now();
  expect(await resolveCompanionOverview(page, 20_000, 20_000)).toEqual({
    unreachable: '/companions redirected to /dashboard',
  });
  expect(Date.now() - started).toBeLessThan(5_000);
});

test('names the redirect when /companions is left while the lookup waits', async ({ page }) => {
  await serveCompanions(
    page,
    `<div class="animate-pulse">Loading</div>
     <script>setTimeout(() => {
       history.pushState({}, '', '/dashboard');
       document.body.innerHTML = '<p>No tasks yet</p>';
     }, 300);</script>`
  );
  expect(await resolveCompanionOverview(page, 2_000, 500)).toEqual({
    unreachable: '/companions redirected to /dashboard',
  });
});
