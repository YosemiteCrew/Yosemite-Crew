import { expect, test } from '@playwright/test';
import {
  contradictoryPanels,
  documentOverflows,
  forwardLookingRows,
  headingNames,
  inventoryCounts,
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
  await page.setContent(`<section><h3>Patient flags</h3><p>No active flags for this patient.</p></section>`);
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
