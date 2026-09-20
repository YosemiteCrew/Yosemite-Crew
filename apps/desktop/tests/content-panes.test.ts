import {
  SPLIT_DIVIDER_WIDTH,
  contentPaneBounds,
  layoutContentPanes,
  type ContentPaneLayout,
} from '../src/ui/content-panes';

const CHROME = 40;
const RAIL = 240;

const makeHost = (ids: string[]) => {
  const views = new Map(ids.map((id) => [id, { id } as never]));
  return {
    views,
    get: (id: string) => views.get(id),
    setBounds: jest.fn(),
  };
};

const makeSurface = () => ({
  added: [] as unknown[],
  removed: [] as unknown[],
  addChildView(view: never) {
    this.added.push(view);
  },
  removeChildView(view: never) {
    this.removed.push(view);
  },
});

// The doubles carry more than the production interfaces do - makeSurface records
// what was mounted - so the override bag has to be typed as the doubles, not as
// ContentPaneLayout, or `surface.added` is not on the union the tests read back.
type TestHost = ReturnType<typeof makeHost>;
type TestSurface = ReturnType<typeof makeSurface>;

type LayoutOverrides = Partial<Omit<ContentPaneLayout, 'host' | 'surface'>> & {
  host?: TestHost;
  surface?: TestSurface;
};

const layout = (over: LayoutOverrides = {}) => {
  const host = over.host ?? makeHost(['a', 'b']);
  const surface = over.surface ?? makeSurface();
  const mounted = layoutContentPanes({
    host,
    surface,
    attachedTabId: 'a',
    splitId: null,
    mountedSplitId: null,
    bounds: { width: 1280, height: 800 },
    isVertical: false,
    chromeStripHeight: CHROME,
    verticalTabWidth: RAIL,
    ...over,
  });
  return { host, surface, mounted };
};

describe('contentPaneBounds', () => {
  test('a full pane fills the content area below the chrome strip', () => {
    expect(contentPaneBounds('full', { width: 1280, height: 800 }, false, CHROME, RAIL)).toEqual({
      x: 0,
      y: CHROME,
      width: 1280,
      height: 760,
    });
  });

  // #3301: the panes used to meet edge to edge, so there was no line marking
  // where one view ended and the next began. The left pane gives up its last
  // column and the window background shows through as the divider.
  test('left and right panes leave exactly the divider between them', () => {
    const b = { width: 1025, height: 700 };
    const left = contentPaneBounds('left', b, false, CHROME, RAIL);
    const right = contentPaneBounds('right', b, false, CHROME, RAIL);
    expect(right.x - (left.x + left.width)).toBe(SPLIT_DIVIDER_WIDTH);
    expect(right.x + right.width).toBe(b.width);
  });

  test('the divider does not move the right pane, so the split stays centred', () => {
    const b = { width: 1024, height: 700 };
    expect(contentPaneBounds('right', b, false, CHROME, RAIL).x).toBe(512);
  });

  test('vertical tabs get the same divider', () => {
    const b = { width: 1280, height: 800 };
    const left = contentPaneBounds('left', b, true, CHROME, RAIL);
    const right = contentPaneBounds('right', b, true, CHROME, RAIL);
    expect(right.x - (left.x + left.width)).toBe(SPLIT_DIVIDER_WIDTH);
    expect(left.x).toBe(RAIL);
  });

  test('a window too narrow to divide clamps the left pane to zero rather than negative', () => {
    expect(contentPaneBounds('left', { width: 1, height: 700 }, false, CHROME, RAIL).width).toBe(0);
  });

  test('an unsplit pane keeps the full width, divider or not', () => {
    expect(contentPaneBounds('full', { width: 1025, height: 700 }, false, CHROME, RAIL).width).toBe(
      1025
    );
  });

  test('vertical tabs move the content area right by the rail width', () => {
    const right = contentPaneBounds('right', { width: 1280, height: 800 }, true, CHROME, RAIL);
    expect(right.x).toBe(RAIL + Math.floor((1280 - RAIL) / 2));
    expect(right.y).toBe(0);
    expect(right.x + right.width).toBe(1280);
  });

  test('a window shorter than the chrome strip clamps to a zero-height pane', () => {
    expect(contentPaneBounds('full', { width: 400, height: 10 }, false, CHROME, RAIL).height).toBe(
      0
    );
  });
});

describe('layoutContentPanes', () => {
  test('without a split the active tab takes the whole content area', () => {
    const { host, surface, mounted } = layout();
    expect(host.setBounds).toHaveBeenCalledWith('a', {
      x: 0,
      y: CHROME,
      width: 1280,
      height: 760,
    });
    expect(mounted).toBeNull();
    expect(surface.added).toHaveLength(0);
  });

  test('a split mounts both panes and reports the tab in the right pane', () => {
    const { host, surface, mounted } = layout({ splitId: 'b' });
    expect(mounted).toBe('b');
    expect(host.setBounds).toHaveBeenCalledWith('a', expect.objectContaining({ x: 0, width: 639 }));
    expect(host.setBounds).toHaveBeenCalledWith('b', expect.objectContaining({ x: 640 }));
    expect(surface.added).toEqual([host.get('a'), host.get('b')]);
    expect(surface.removed).toHaveLength(0);
  });

  // #3287: clearing splitId alone left the old pane mounted above the primary,
  // so it kept covering the right half of the window and taking its clicks.
  test('closing the split detaches the pane that was on the right', () => {
    const { host, surface, mounted } = layout({ splitId: null, mountedSplitId: 'b' });
    expect(surface.removed).toEqual([host.get('b')]);
    expect(mounted).toBeNull();
    expect(host.setBounds).toHaveBeenCalledWith('a', expect.objectContaining({ width: 1280 }));
  });

  test('the closed split does not come back on a later resize', () => {
    const host = makeHost(['a', 'b']);
    const surface = makeSurface();
    const first = layout({ host, surface, splitId: null, mountedSplitId: 'b' }).mounted;
    const again = layout({ host, surface, splitId: null, mountedSplitId: first }).mounted;
    expect(again).toBeNull();
    expect(surface.removed).toHaveLength(1);
    expect(surface.added).toHaveLength(0);
  });

  test('moving the split to another tab detaches only the previous pane', () => {
    const host = makeHost(['a', 'b', 'c']);
    const { surface, mounted } = layout({ host, splitId: 'c', mountedSplitId: 'b' });
    expect(surface.removed).toEqual([host.get('b')]);
    expect(mounted).toBe('c');
  });

  test('a split pane promoted to the active tab is kept, not detached', () => {
    const host = makeHost(['a', 'b']);
    const { surface, mounted } = layout({
      host,
      attachedTabId: 'b',
      splitId: null,
      mountedSplitId: 'b',
    });
    expect(surface.removed).toHaveLength(0);
    expect(mounted).toBeNull();
  });

  test('a split pointing at the active tab is not a split', () => {
    const { surface, mounted } = layout({ splitId: 'a' });
    expect(mounted).toBeNull();
    expect(surface.added).toHaveLength(0);
  });

  test('a split whose view is already destroyed lays out as a single pane', () => {
    const host = makeHost(['a']);
    const { mounted } = layout({ host, splitId: 'gone' });
    expect(mounted).toBeNull();
    expect(host.setBounds).toHaveBeenCalledWith('a', expect.objectContaining({ width: 1280 }));
  });

  test('a destroyed split view is dropped from tracking without a detach', () => {
    const host = makeHost(['a']);
    const { surface, mounted } = layout({ host, splitId: null, mountedSplitId: 'gone' });
    expect(surface.removed).toHaveLength(0);
    expect(mounted).toBeNull();
  });

  test('with no active tab the layout is left alone', () => {
    const { host, surface, mounted } = layout({ attachedTabId: null, mountedSplitId: 'b' });
    expect(host.setBounds).not.toHaveBeenCalled();
    expect(surface.removed).toHaveLength(0);
    expect(mounted).toBe('b');
  });
});
