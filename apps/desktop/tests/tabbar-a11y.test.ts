import untypedA11y from '../src/pages/tabbar-a11y.js';

// The page helper is a plain browser script loaded over file:// by the tab bar
// under a strict CSP, so it is required here rather than imported as a module -
// untyped, hence the surface restated below for the type checker.
interface TabLike {
  id?: string;
  title?: string;
  url?: string;
  muted?: boolean;
}

const a11y: {
  tabName: (tab: TabLike | null | undefined) => string;
  closeLabel: (tab: TabLike) => string;
  muteLabel: (tab: TabLike) => string;
  rovingTabIndex: (tabs: TabLike[], activeId: string | null, tabId: string) => number;
  keyAction: (key: string, orientation: string) => string | null;
  moveIndex: (action: string, index: number, count: number) => number | null;
  resultsStatus: (count: number) => string;
} = untypedA11y;

describe('accessible names', () => {
  test('a close button names the tab it closes', () => {
    expect(a11y.closeLabel({ title: 'Bella (Golden Retriever)' })).toBe(
      'Close Bella (Golden Retriever)'
    );
  });

  test('two tabs never produce the same close button name', () => {
    const first = a11y.closeLabel({ title: 'Bella' });
    const second = a11y.closeLabel({ title: 'Max' });
    expect(first).not.toBe(second);
  });

  test('a tab with no title yet falls back to its url, not a bare "Close"', () => {
    const label = a11y.closeLabel({ title: '   ', url: 'https://example.test/patients' });
    expect(label).toBe('Close https://example.test/patients');
  });

  test('a tab with neither title nor url is still named', () => {
    expect(a11y.tabName({})).toBe('Untitled tab');
    expect(a11y.closeLabel({})).toBe('Close Untitled tab');
  });

  test('the mute control says which way it will toggle, and for which tab', () => {
    expect(a11y.muteLabel({ title: 'Bella', muted: false })).toBe('Mute Bella');
    expect(a11y.muteLabel({ title: 'Bella', muted: true })).toBe('Unmute Bella');
  });
});

describe('roving tabindex', () => {
  const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  test('the active tab is the strip’s single tab stop', () => {
    expect(a11y.rovingTabIndex(tabs, 'b', 'b')).toBe(0);
  });

  test('every other tab is out of the document tab order', () => {
    expect(a11y.rovingTabIndex(tabs, 'b', 'a')).toBe(-1);
    expect(a11y.rovingTabIndex(tabs, 'b', 'c')).toBe(-1);
  });

  test('exactly one tab is reachable, never two and never none', () => {
    const reachable = tabs.filter((t) => a11y.rovingTabIndex(tabs, 'c', t.id as string) === 0);
    expect(reachable).toHaveLength(1);
  });

  test('with no active tab the first tab takes the slot, so the strip stays reachable', () => {
    expect(a11y.rovingTabIndex(tabs, null, 'a')).toBe(0);
    expect(a11y.rovingTabIndex(tabs, 'gone', 'a')).toBe(0);
    expect(a11y.rovingTabIndex(tabs, 'gone', 'b')).toBe(-1);
  });

  test('an empty strip has no tab stop', () => {
    expect(a11y.rovingTabIndex([], null, 'a')).toBe(-1);
  });
});

describe('keyAction', () => {
  test('a horizontal strip moves on Left/Right', () => {
    expect(a11y.keyAction('ArrowRight', 'horizontal')).toBe('next');
    expect(a11y.keyAction('ArrowLeft', 'horizontal')).toBe('prev');
  });

  test('a vertical rail moves on Up/Down', () => {
    expect(a11y.keyAction('ArrowDown', 'vertical')).toBe('next');
    expect(a11y.keyAction('ArrowUp', 'vertical')).toBe('prev');
  });

  test('each orientation ignores the other axis rather than swallowing it', () => {
    expect(a11y.keyAction('ArrowDown', 'horizontal')).toBeNull();
    expect(a11y.keyAction('ArrowUp', 'horizontal')).toBeNull();
    expect(a11y.keyAction('ArrowRight', 'vertical')).toBeNull();
    expect(a11y.keyAction('ArrowLeft', 'vertical')).toBeNull();
  });

  test('an unknown orientation is treated as horizontal', () => {
    expect(a11y.keyAction('ArrowRight', 'sideways')).toBe('next');
  });

  test('Home and End jump to the ends in either orientation', () => {
    for (const orientation of ['horizontal', 'vertical']) {
      expect(a11y.keyAction('Home', orientation)).toBe('first');
      expect(a11y.keyAction('End', orientation)).toBe('last');
    }
  });

  test('Enter and Space activate, Delete and Backspace close', () => {
    expect(a11y.keyAction('Enter', 'horizontal')).toBe('activate');
    expect(a11y.keyAction(' ', 'horizontal')).toBe('activate');
    expect(a11y.keyAction('Delete', 'horizontal')).toBe('close');
    expect(a11y.keyAction('Backspace', 'horizontal')).toBe('close');
  });

  test('an unrelated key is not claimed', () => {
    expect(a11y.keyAction('a', 'horizontal')).toBeNull();
    expect(a11y.keyAction('Tab', 'horizontal')).toBeNull();
  });

  test('a key matching an Object.prototype member is not mistaken for a mapping', () => {
    expect(a11y.keyAction('constructor', 'horizontal')).toBeNull();
    expect(a11y.keyAction('toString', 'vertical')).toBeNull();
  });
});

describe('moveIndex', () => {
  test('next and prev step by one', () => {
    expect(a11y.moveIndex('next', 0, 3)).toBe(1);
    expect(a11y.moveIndex('prev', 2, 3)).toBe(1);
  });

  test('movement wraps at both ends, matching Ctrl+Tab cycling', () => {
    expect(a11y.moveIndex('next', 2, 3)).toBe(0);
    expect(a11y.moveIndex('prev', 0, 3)).toBe(2);
  });

  test('first and last land on the ends', () => {
    expect(a11y.moveIndex('first', 2, 4)).toBe(0);
    expect(a11y.moveIndex('last', 0, 4)).toBe(3);
  });

  test('every result is a valid index for the strip', () => {
    for (const action of ['next', 'prev', 'first', 'last']) {
      for (let i = 0; i < 5; i++) {
        const next = a11y.moveIndex(action, i, 5) as number;
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(5);
      }
    }
  });

  test('an empty strip has nowhere to move', () => {
    expect(a11y.moveIndex('next', 0, 0)).toBeNull();
    expect(a11y.moveIndex('first', 0, 0)).toBeNull();
  });

  test('a non-movement action yields no index', () => {
    expect(a11y.moveIndex('activate', 1, 3)).toBeNull();
    expect(a11y.moveIndex('close', 1, 3)).toBeNull();
  });
});

describe('resultsStatus', () => {
  test('no matches is announced as words, not an empty string', () => {
    expect(a11y.resultsStatus(0)).toBe('No matching tabs');
  });

  test('a single match is not announced in the plural', () => {
    expect(a11y.resultsStatus(1)).toBe('1 tab');
  });

  test('several matches report the count', () => {
    expect(a11y.resultsStatus(4)).toBe('4 tabs');
  });

  test('every count produces a non-empty announcement', () => {
    for (let i = 0; i < 6; i++) {
      expect(a11y.resultsStatus(i).length).toBeGreaterThan(0);
    }
  });
});
