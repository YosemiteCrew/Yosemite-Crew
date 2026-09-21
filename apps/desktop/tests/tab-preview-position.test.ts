// The page helper is a plain browser script loaded over file:// under a strict
// CSP, so it is required rather than imported as a module - untyped, hence the
// surface restated below for the type checker.
import untypedPosition from '../src/pages/tab-preview-position.js';

interface Rect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

const position: {
  previewPosition: (
    rect: Rect,
    viewport: { width: number; height: number },
    railWidth: number
  ) => { left: number; top: number };
  WIDTH: number;
  HEIGHT: number;
  GAP: number;
} = untypedPosition;

const { previewPosition, WIDTH, HEIGHT, GAP } = position;

// A 1280x800 window, the smaller of the two the 2026-09-18 UI check used.
const viewport = { width: 1280, height: 800 };
const tab = (left: number): Rect => ({ left, top: 6, bottom: 34, width: 160 });

const fitsIn = (
  at: { left: number; top: number },
  bounds: { width: number; height: number }
): boolean =>
  at.left >= 0 &&
  at.top >= 0 &&
  at.left + WIDTH <= bounds.width &&
  at.top + HEIGHT <= bounds.height;

describe('previewPosition, horizontal tabs', () => {
  test('centres the thumbnail under the tab it belongs to', () => {
    const at = previewPosition(tab(400), viewport, 0);
    expect(at.left).toBe(400 + (160 - WIDTH) / 2);
    expect(at.top).toBe(34 + GAP);
  });

  test('the first tab does not push it off the left edge', () => {
    const at = previewPosition(tab(8), viewport, 0);
    expect(at.left).toBe(0);
    expect(fitsIn(at, viewport)).toBe(true);
  });

  test('a tab at the right-hand end does not push it off the right edge', () => {
    const at = previewPosition(tab(viewport.width - 170), viewport, 0);
    expect(at.left).toBe(viewport.width - WIDTH);
    expect(fitsIn(at, viewport)).toBe(true);
  });

  test('it stays inside a window too short to hold it below the tab', () => {
    const short = { width: 1280, height: 220 };
    const at = previewPosition(tab(400), short, 0);
    expect(at.top).toBe(short.height - HEIGHT);
    expect(fitsIn(at, short)).toBe(true);
  });
});

describe('previewPosition, vertical tabs', () => {
  test('sits beside the rail rather than over it', () => {
    const at = previewPosition({ left: 8, top: 120, bottom: 152, width: 224 }, viewport, 240);
    expect(at.left).toBe(240 + GAP);
    expect(at.top).toBe(120);
    expect(fitsIn(at, viewport)).toBe(true);
  });

  test('a tab near the bottom of a full-height rail is pulled back into view', () => {
    const at = previewPosition({ left: 8, top: 760, bottom: 792, width: 224 }, viewport, 240);
    expect(at.top).toBe(viewport.height - HEIGHT);
    expect(fitsIn(at, viewport)).toBe(true);
  });

  test('the rail is cleared, not straddled, for any rail width', () => {
    for (const rail of [180, 240, 320]) {
      const at = previewPosition(
        { left: 8, top: 10, bottom: 42, width: rail - 16 },
        viewport,
        rail
      );
      expect(at.left).toBeGreaterThanOrEqual(rail);
    }
  });
});

describe('previewPosition, degenerate viewports', () => {
  // The collapsed chrome strip is 40px tall and the rail 240px wide: there is
  // no in-bounds position in either, and the caller does not show a thumbnail
  // there. What this pins is that the answer is the near corner rather than a
  // negative offset, which would put the thumbnail off-screen entirely.
  test('a viewport smaller than the thumbnail answers the top-left corner', () => {
    expect(previewPosition(tab(400), { width: 1280, height: 40 }, 0).top).toBe(0);
    expect(previewPosition(tab(400), { width: 240, height: 800 }, 240).left).toBe(0);
  });
});
