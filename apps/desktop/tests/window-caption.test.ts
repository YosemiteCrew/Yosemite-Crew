import fs from 'node:fs';
import path from 'node:path';

// The page helper is a plain browser script loaded over file:// by the tab bar
// under a strict CSP, so it is required here rather than imported as a module -
// untyped, hence the surface restated below for the type checker.
import untypedCaption from '../src/pages/window-caption.js';

interface CaptionSpec {
  label: string;
  glyph: string;
}

type GlyphShape = { tag: string } & Record<string, string | undefined>;

const caption: {
  maximizeButton: (isMaximized: boolean) => CaptionSpec;
  MAXIMIZE: CaptionSpec;
  RESTORE: CaptionSpec;
  GLYPHS: Record<string, GlyphShape[]>;
} = untypedCaption;

describe('maximizeButton', () => {
  test('a restored window offers Maximize', () => {
    expect(caption.maximizeButton(false).label).toBe('Maximize');
  });

  test('a maximised window offers Restore', () => {
    expect(caption.maximizeButton(true).label).toBe('Restore');
  });

  test('the two states select different glyphs', () => {
    expect(caption.maximizeButton(true).glyph).not.toBe(caption.maximizeButton(false).glyph);
  });

  test('the label is both the accessible name and the tooltip, so it is never blank', () => {
    for (const isMaximized of [true, false]) {
      expect(caption.maximizeButton(isMaximized).label.length).toBeGreaterThan(0);
    }
  });
});

// A 1.1px stroke centred on a whole coordinate straddles two device-pixel rows
// and renders as two half-covered greys - which is how the minimise bar came to
// measure 2.2:1 against the tab strip while maximise and close reached 5.9:1
// (issue #3293). An axis-aligned stroke is crisp when the coordinate
// PERPENDICULAR to it sits on the half-pixel grid: a horizontal bar is decided
// by its y, a vertical one by its x, and the length along the stroke is free.
// Diagonals are antialiased whatever you do, so no coordinate decides them.
//
// The reader below walks the subset of path syntax these four glyphs use and
// resolves absolute coordinates, so a relative command that lands off-grid is
// caught as well as an absolute one written off-grid.
type Orientation = 'horizontal' | 'vertical' | 'diagonal';
interface Segment {
  orientation: Orientation;
  /** The coordinate that decides crispness; absent for a diagonal. */
  at?: number;
}

const pathSegments = (svg: string): Segment[] => {
  const segments: Segment[] = [];
  for (const match of svg.matchAll(/\bd="([^"]+)"/g)) {
    let [x, y] = [0, 0];
    // "M2.5 2.5l7 7M9.5 2.5l-7 7" -> one entry per command letter + its numbers.
    const steps = (match[1] ?? '').matchAll(/([MmLlHhVv])\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?/g);
    for (const step of steps) {
      const [command, first, second] = [step[1], Number(step[2]), Number(step[3])];
      const from = { x, y };
      if (command === 'M') [x, y] = [first, second as number];
      else if (command === 'm') [x, y] = [x + first, y + (second as number)];
      else if (command === 'L') [x, y] = [first, second as number];
      else if (command === 'l') [x, y] = [x + first, y + (second as number)];
      else if (command === 'H') x = first;
      else if (command === 'h') x += first;
      else if (command === 'V') y = first;
      else y += first;

      if (command === 'M' || command === 'm') continue; // a move draws nothing
      if (from.y === y && from.x !== x) segments.push({ orientation: 'horizontal', at: y });
      else if (from.x === x && from.y !== y) segments.push({ orientation: 'vertical', at: x });
      else segments.push({ orientation: 'diagonal' });
    }
  }
  return segments;
};

// Every rect edge is axis-aligned: two verticals decided by x, two horizontals
// decided by y.
const rectSegments = (svg: string): Segment[] => {
  const segments: Segment[] = [];
  for (const match of svg.matchAll(/<rect\b[^>]*\/>/g)) {
    const attr = (name: string): number => {
      const found = new RegExp(`${name}="(-?\\d+(?:\\.\\d+)?)"`).exec(match[0]);
      if (!found) throw new Error(`rect is missing ${name}: ${match[0]}`);
      return Number(found[1]);
    };
    const [x, y, width, height] = [attr('x'), attr('y'), attr('width'), attr('height')];
    segments.push(
      { orientation: 'vertical', at: x },
      { orientation: 'vertical', at: x + width },
      { orientation: 'horizontal', at: y },
      { orientation: 'horizontal', at: y + height }
    );
  }
  return segments;
};

const segmentsOf = (svg: string): Segment[] => {
  const segments = [...rectSegments(svg), ...pathSegments(svg)];
  // Without this an unparsed glyph would pass the grid check by drawing nothing.
  if (segments.length === 0) throw new Error(`no stroke geometry found in: ${svg}`);
  return segments;
};

const tabbarHtml = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'tabbar.html'),
  'utf8'
);

const captionButtonSvg = (id: string): string => {
  const button = new RegExp(`<button[^>]*id="${id}"[\\s\\S]*?</button>`).exec(tabbarHtml);
  if (!button) throw new Error(`no #${id} caption button in tabbar.html`);
  return button[0];
};

// Every glyph is read out of the shipped markup, so these assert what renders
// rather than a copy of it.
const maximizeGlyph = (glyph: string): string => {
  const svg = new RegExp(`<svg data-glyph="${glyph}"[\\s\\S]*?</svg>`).exec(
    captionButtonSvg('win-max')
  );
  if (!svg) throw new Error(`no data-glyph="${glyph}" in the maximise button`);
  return svg[0];
};

describe('caption glyph geometry', () => {
  test.each([
    ['the Maximize glyph', maximizeGlyph('maximize')],
    ['the Restore glyph', maximizeGlyph('restore')],
    ['the minimise glyph', captionButtonSvg('win-min')],
  ])('every axis-aligned stroke in %s sits on the half-pixel grid', (_name, svg) => {
    const aligned = segmentsOf(svg).filter((s) => s.orientation !== 'diagonal');
    expect(aligned.length).toBeGreaterThan(0);
    expect(aligned.filter((s) => !Number.isInteger((s.at as number) - 0.5))).toEqual([]);
  });

  test('the button carries a glyph for each state maximizeButton can select', () => {
    // Without this the label could flip while the icon never changed - and the
    // geometry table above would still be green, because it reads the markup.
    for (const isMaximized of [true, false]) {
      expect(() => maximizeGlyph(caption.maximizeButton(isMaximized).glyph)).not.toThrow();
    }
  });

  test('the close glyph is two diagonals, which no coordinate can snap', () => {
    // Stated rather than assumed: it is the reason close is absent from the
    // table above, and it is what makes that absence safe.
    expect(segmentsOf(captionButtonSvg('win-close'))).toEqual([
      { orientation: 'diagonal' },
      { orientation: 'diagonal' },
    ]);
  });
});

// The local pages (welcome, what's new, loading) have no caption markup of
// their own: local-window-header.js builds their buttons from this table. The
// tab bar keeps its own markup, so the two title bars can only stay identical
// if something holds them to each other - that is what this block is.
const glyphSvg = (name: string): string => {
  const shapes = caption.GLYPHS[name];
  if (!shapes) throw new Error(`no ${name} glyph in the table`);
  return (
    '<svg>' +
    shapes
      .map((shape) => {
        const attributes = Object.keys(shape)
          .filter((key) => key !== 'tag' && shape[key] !== undefined)
          .map((key) => `${key}="${shape[key]}"`)
          .join(' ');
        return `<${shape.tag} ${attributes} />`;
      })
      .join('') +
    '</svg>'
  );
};

describe('the shared caption glyph table', () => {
  test.each([
    ['maximize', maximizeGlyph('maximize')],
    ['restore', maximizeGlyph('restore')],
    ['minimize', captionButtonSvg('win-min')],
    ['close', captionButtonSvg('win-close')],
  ])('the %s entry draws what the tab bar draws', (name, markup) => {
    expect(segmentsOf(glyphSvg(name))).toEqual(segmentsOf(markup));
  });

  test('every glyph in the table is one the caption buttons ask for', () => {
    expect(Object.keys(caption.GLYPHS).sort()).toEqual(
      ['close', 'maximize', 'minimize', 'restore'].sort()
    );
  });

  test.each([['maximize'], ['restore'], ['minimize']])(
    'every axis-aligned stroke in the %s entry sits on the half-pixel grid',
    (name) => {
      const aligned = segmentsOf(glyphSvg(name)).filter((s) => s.orientation !== 'diagonal');
      expect(aligned.length).toBeGreaterThan(0);
      expect(aligned.filter((s) => !Number.isInteger((s.at as number) - 0.5))).toEqual([]);
    }
  );

  test('both states maximizeButton can select have an entry to draw', () => {
    for (const isMaximized of [true, false]) {
      expect(caption.GLYPHS[caption.maximizeButton(isMaximized).glyph]).toBeDefined();
    }
  });
});
