// The indicator rules are a plain browser script: the local pages load them
// over file:// under a strict CSP, so a compiled module would not reach them.
// It also assigns `module.exports`, so it imports here - untyped, hence the
// surface restated below for the type checker.
import fs from 'node:fs';
import path from 'node:path';
import untypedIndicators from '../src/pages/tab-indicators.js';
import type { SyncState } from '../src/sync/sync-status';

interface SyncBadgeView {
  className: string;
  label: string;
  ariaLabel: string;
}
interface TabBadgeView {
  className: string;
  text: string;
  label: string;
  title: string;
}
interface PinnedGlyph {
  // The script is untyped JS, so its literals widen to string here.
  kind: string;
  text?: string;
}

const indicators: {
  SYNC_LABELS: Record<string, string>;
  syncBadge: (state: string) => SyncBadgeView;
  tabBadge: (tab: unknown) => TabBadgeView | null;
  monogram: (title: unknown) => string;
  pinnedGlyph: (tab: unknown) => PinnedGlyph;
} = untypedIndicators;

// The bug: the healthy `idle` state had neither a CSS rule nor a label, so the
// dot was not drawn at all. This assignment is the compile-time half of the
// guard - a SyncState added to the union without a label here fails type-check.
const SYNC_LABELS: Record<SyncState, string> = indicators.SYNC_LABELS;
const ALL_STATES = Object.keys(SYNC_LABELS) as SyncState[];

const tabbarHtml = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'tabbar.html'),
  'utf8'
);

describe('syncBadge', () => {
  test('the healthy state is visible and reads as up to date', () => {
    expect(indicators.syncBadge('idle')).toEqual({
      className: 'idle',
      label: 'Up to date',
      ariaLabel: 'Sync: Up to date',
    });
  });

  test.each(ALL_STATES)('%s has a label and keeps its own class', (state) => {
    const view = indicators.syncBadge(state);
    expect(view.className).toBe(state);
    expect(view.label.length).toBeGreaterThan(0);
    expect(view.ariaLabel).toBe(`Sync: ${view.label}`);
  });

  // The runtime half of the guard: a class with no colour rule draws nothing,
  // which is indistinguishable from the dot being absent.
  test.each(ALL_STATES)('%s has a colour rule in tabbar.html', (state) => {
    expect(tabbarHtml).toContain(`#sync-badge.${state} {`);
  });

  test('tabbar.html styles no state outside the union', () => {
    const styled = [...tabbarHtml.matchAll(/#sync-badge\.([a-z-]+) \{/g)].map((m) => m[1]);
    expect(styled.sort()).toEqual([...ALL_STATES].sort());
  });

  test('an unrecognised state still draws a dot rather than vanishing', () => {
    const view = indicators.syncBadge('synced');
    expect(view.className).toBe('not-ready');
    expect(view.label).toBe('Sync status unknown');
    expect(view.ariaLabel).toBe('Sync status unknown');
  });

  test('a state named after an Object prototype key is not treated as known', () => {
    expect(indicators.syncBadge('constructor').label).toBe('Sync status unknown');
  });
});

describe('tabBadge', () => {
  test('a network failure gets the offline badge, not the error badge', () => {
    const badge = indicators.tabBadge({ error: null, offline: true });
    expect(badge?.className).toBe('tab-badge tab-badge--offline');
    expect(badge?.label).toBe('Tab is offline');
  });

  test('the offline badge carries no text, because the app font has no glyph', () => {
    expect(indicators.tabBadge({ offline: true })?.text).toBe('');
  });

  test('a page error keeps the error badge and names the failure in the tooltip', () => {
    const badge = indicators.tabBadge({ error: 'ERR_CERT_DATE_INVALID' });
    expect(badge?.className).toBe('tab-badge tab-badge--error');
    expect(badge?.text).toBe('!');
    expect(badge?.title).toBe('ERR_CERT_DATE_INVALID');
    expect(badge?.label).toBe('Page failed to load');
  });

  test('a healthy tab gets no badge', () => {
    expect(indicators.tabBadge({ error: null, offline: false })).toBeNull();
    expect(indicators.tabBadge(null)).toBeNull();
  });
});

describe('pinnedGlyph', () => {
  test('a favicon wins', () => {
    expect(
      indicators.pinnedGlyph({ favicon: 'data:image/png;base64,x', title: 'Appointments' })
    ).toEqual({ kind: 'favicon' });
  });

  test('without a favicon the title supplies a monogram', () => {
    expect(indicators.pinnedGlyph({ favicon: '', title: 'appointments' })).toEqual({
      kind: 'monogram',
      text: 'A',
    });
  });

  test('a title with no letter or digit falls back to the page icon', () => {
    expect(indicators.pinnedGlyph({ favicon: '', title: '—' })).toEqual({ kind: 'icon' });
    expect(indicators.pinnedGlyph({ favicon: '', title: '' })).toEqual({ kind: 'icon' });
  });
});

describe('monogram', () => {
  test.each([
    ['Appointments', 'A'],
    ['  spaced', 'S'],
    ['3M Clinic', '3'],
    ['Übersicht', 'Ü'],
    ['#tag', 'T'],
    ['😀 Clinic', 'C'],
  ])('%s -> %s', (title, expected) => {
    expect(indicators.monogram(title)).toBe(expected);
  });

  test.each([['—'], [''], ['  ']])('%s yields nothing', (title) => {
    expect(indicators.monogram(title)).toBe('');
  });

  test('a missing title does not throw', () => {
    expect(indicators.monogram(undefined)).toBe('');
    expect(indicators.monogram(null)).toBe('');
  });
});

describe('tabbar.html wiring', () => {
  test('the page loads the shared indicator rules', () => {
    expect(tabbarHtml).toContain('<script src="tab-indicators.js"></script>');
  });

  test('the search button draws an SVG, not a character the app font lacks', () => {
    expect(tabbarHtml).not.toContain('⌕');
    expect(tabbarHtml).toContain('class="tab-action-icon"');
  });

  test('the sync dot announces itself', () => {
    expect(tabbarHtml).toContain('role="status"');
  });
});
