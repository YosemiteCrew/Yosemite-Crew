/**
 * @jest-environment jsdom
 */

// The tab row is a plain browser script: the local pages load it over file://
// under a strict CSP, so a compiled module would not reach them. It assigns
// `module.exports`, so it imports here - untyped, hence the surface restated
// below for the type checker.
import fs from 'node:fs';
import path from 'node:path';
// Loaded for their side effect: both attach themselves to globalThis, which is
// where tab-row.js reads them from at call time.
import '../src/pages/tab-indicators.js';
import '../src/pages/tabbar-a11y.js';
import untypedRow from '../src/pages/tab-row.js';

interface Tab {
  id: string;
  title?: string;
  url?: string;
  favicon?: string;
  loading?: boolean;
  pinned?: boolean;
  offline?: boolean;
  error?: string;
  audible?: boolean;
  muted?: boolean;
}

interface RowSlots {
  spinner: Element;
  favicon: HTMLImageElement;
  monogram: Element;
  pageIcon: Element;
  label: Element;
  badge: Element;
  audio: HTMLButtonElement;
}

const tabRow = untypedRow as {
  buildRow: (onToggleMute?: (id: string) => void) => HTMLElement;
  updateRow: (inner: Element, tab: Tab) => void;
  slotsOf: (inner: Element) => RowSlots;
  failedFavicons: Set<string>;
};

const TABBAR_HTML = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'tabbar.html'),
  'utf8'
);
const TAB_ROW_JS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'tab-row.js'),
  'utf8'
);

const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't1', title: 'Appointments', ...over });
const isHidden = (el: Element): boolean => el.hasAttribute('hidden');

/** A row as the strip creates one: inside a .tab div, so the mute button can
 *  read the tab id back off its parent the way the page does. */
const mountRow = (onToggleMute?: (id: string) => void): HTMLElement => {
  const div = document.createElement('div');
  div.className = 'tab';
  div.dataset.tabId = 't1';
  const inner = tabRow.buildRow(onToggleMute);
  div.appendChild(inner);
  document.body.appendChild(div);
  return inner;
};

beforeEach(() => {
  document.body.innerHTML = '';
  tabRow.failedFavicons.clear();
});

describe('tab row slots', () => {
  test('a new row carries every slot, and only the label is showing', () => {
    const inner = mountRow();
    const slots = tabRow.slotsOf(inner);

    expect(inner.children).toHaveLength(7);
    expect(Array.from(inner.children).map((el) => el.getAttribute('class'))).toEqual([
      'tab-spinner',
      'tab-favicon',
      'tab-monogram',
      'tab-page-icon',
      'tab-label',
      'tab-badge',
      'tab-audio',
    ]);
    expect(isHidden(slots.label)).toBe(false);
    for (const name of ['spinner', 'favicon', 'monogram', 'pageIcon', 'badge', 'audio'] as const) {
      expect(isHidden(slots[name])).toBe(true);
    }
  });

  test('the page icon is an SVG, so it is hidden by attribute and not by .hidden', () => {
    // `hidden` as an IDL property exists on HTMLElement only. Assigning it here
    // would set an expando, leave no attribute and paint the icon anyway - a
    // failure no assertion about the property could see.
    const slots = tabRow.slotsOf(mountRow());
    expect(slots.pageIcon.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(slots.pageIcon).not.toBeInstanceOf(window.HTMLElement);
    expect(slots.pageIcon.hasAttribute('hidden')).toBe(true);
  });
});

describe('state that changes after the row exists', () => {
  // #3369 wrote the badge and the pinned glyph on the build path, which was
  // correct while the strip cleared innerHTML and rebuilt every tab every
  // second. The strip now reconciles, so a row outlives any one poll and
  // anything written only at build time freezes at its first value.

  test('the error/offline badge follows the tab, on the same element', () => {
    const inner = mountRow();
    const { badge } = tabRow.slotsOf(inner);

    tabRow.updateRow(inner, tab());
    expect(isHidden(badge)).toBe(true);

    tabRow.updateRow(inner, tab({ offline: true }));
    expect(isHidden(badge)).toBe(false);
    expect(badge.getAttribute('class')).toBe('tab-badge tab-badge--offline');
    expect(badge.getAttribute('aria-label')).toBe('Tab is offline');
    // No text: the app font has no glyph for U+26A0, so the slash is CSS.
    expect(badge.textContent).toBe('');

    tabRow.updateRow(inner, tab({ error: 'ECONNREFUSED' }));
    expect(badge.getAttribute('class')).toBe('tab-badge tab-badge--error');
    expect(badge.textContent).toBe('!');
    expect(badge.getAttribute('title')).toBe('ECONNREFUSED');
    expect(badge.getAttribute('aria-label')).toBe('Page failed to load');

    tabRow.updateRow(inner, tab());
    expect(isHidden(badge)).toBe(true);

    // Identity, not just content: the reconciliation exists to keep the row's
    // children stable, so a badge that was replaced would defeat the point.
    expect(tabRow.slotsOf(inner).badge).toBe(badge);
  });

  test('pinning after creation switches the row to a single glyph and back', () => {
    const inner = mountRow();
    const s = tabRow.slotsOf(inner);

    tabRow.updateRow(inner, tab());
    expect(isHidden(s.label)).toBe(false);

    tabRow.updateRow(inner, tab({ pinned: true, favicon: 'https://x/icon.png' }));
    expect(isHidden(s.label)).toBe(true);
    expect(isHidden(s.favicon)).toBe(false);
    expect(isHidden(s.monogram)).toBe(true);
    expect(isHidden(s.pageIcon)).toBe(true);

    tabRow.updateRow(inner, tab({ pinned: true }));
    expect(isHidden(s.monogram)).toBe(false);
    expect(s.monogram.textContent).toBe('A');
    expect(isHidden(s.favicon)).toBe(true);
    expect(isHidden(s.pageIcon)).toBe(true);

    // A title with no letter or digit yields no monogram, so the generic page
    // icon is the only thing left to draw.
    tabRow.updateRow(inner, tab({ pinned: true, title: '…' }));
    expect(isHidden(s.pageIcon)).toBe(false);
    expect(isHidden(s.monogram)).toBe(true);

    tabRow.updateRow(inner, tab());
    expect(isHidden(s.label)).toBe(false);
    expect(s.label.textContent).toBe('Appointments');
    for (const el of [s.monogram, s.pageIcon, s.favicon]) expect(isHidden(el)).toBe(true);
  });

  test('a loading pinned tab shows the spinner rather than its glyph', () => {
    const inner = mountRow();
    const s = tabRow.slotsOf(inner);
    tabRow.updateRow(inner, tab({ pinned: true, loading: true, favicon: 'https://x/icon.png' }));
    expect(isHidden(s.spinner)).toBe(false);
    for (const el of [s.favicon, s.monogram, s.pageIcon]) expect(isHidden(el)).toBe(true);
  });

  test('the mute button follows audible/muted and reports the tab id it sits on', () => {
    const muted: string[] = [];
    const inner = mountRow((id) => muted.push(id));
    const { audio } = tabRow.slotsOf(inner);

    tabRow.updateRow(inner, tab());
    expect(isHidden(audio)).toBe(true);

    tabRow.updateRow(inner, tab({ audible: true }));
    expect(isHidden(audio)).toBe(false);
    expect(audio.getAttribute('aria-pressed')).toBe('false');
    expect(audio.getAttribute('aria-label')).toBe('Mute Appointments');

    tabRow.updateRow(inner, tab({ audible: true, muted: true }));
    expect(audio.getAttribute('aria-pressed')).toBe('true');
    expect(audio.getAttribute('aria-label')).toBe('Unmute Appointments');

    audio.click();
    expect(muted).toEqual(['t1']);
  });

  test('focus inside the row survives an update', () => {
    const inner = mountRow();
    const { audio } = tabRow.slotsOf(inner);
    tabRow.updateRow(inner, tab({ audible: true }));
    audio.focus();
    expect(document.activeElement).toBe(audio);

    tabRow.updateRow(inner, tab({ audible: true, muted: true, offline: true }));
    tabRow.updateRow(inner, tab({ audible: true, muted: true }));

    expect(document.activeElement).toBe(audio);
    expect(tabRow.slotsOf(inner).audio).toBe(audio);
  });

  test('a favicon that failed once is not requested again', () => {
    const inner = mountRow();
    const { favicon } = tabRow.slotsOf(inner);
    const url = 'https://x/missing.png';

    tabRow.updateRow(inner, tab({ favicon: url }));
    expect(isHidden(favicon)).toBe(false);
    expect(favicon.dataset.url).toBe(url);

    favicon.dispatchEvent(new window.Event('error'));
    expect(tabRow.failedFavicons.has(url)).toBe(true);
    expect(isHidden(favicon)).toBe(true);

    tabRow.updateRow(inner, tab({ favicon: url }));
    expect(isHidden(favicon)).toBe(true);
    expect(favicon.dataset.url).toBe('');
  });
});

describe('the update path is the page path', () => {
  // The tests above prove the row follows a changing tab. These pin the other
  // half: that the page runs this function for every tab on every poll, and
  // that the build path has nothing per-tab to freeze in the first place.

  test('render updates every tab, not only the ones it inserted', () => {
    expect(TABBAR_HTML).toContain(
      'for (const tab of state.tabs) updateTab(byId.get(tab.id), tab);'
    );
  });

  test('updateTab is what calls into the row, and renderTab only builds it', () => {
    const updateTab = /const updateTab = \(div, tab\) => \{([\s\S]*?)\n {6}\};/.exec(TABBAR_HTML);
    expect(updateTab).not.toBeNull();
    expect(updateTab?.[1]).toContain('ycTabRow.updateRow(div.firstElementChild, tab);');

    expect([...TABBAR_HTML.matchAll(/ycTabRow\.buildRow\(/g)]).toHaveLength(1);
    expect([...TABBAR_HTML.matchAll(/ycTabRow\.updateRow\(/g)]).toHaveLength(1);
  });

  test('buildRow cannot read per-tab state, so it cannot freeze any', () => {
    const build = /const buildRow = function \(([^)]*)\) \{([\s\S]*?)\n {2}\};/.exec(TAB_ROW_JS);
    expect(build).not.toBeNull();
    expect(build?.[1]).toBe('onToggleMute');
    const body = build?.[2] ?? '';
    // Guard against an empty slice reading as a pass.
    expect(body).toContain("inner.className = 'tab-inner'");
    expect(body).not.toContain('ycTabIndicators');
    expect(body).not.toMatch(/\btab\./);
  });
});
