import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the desktop shell's colour tokens against the contrast regressions in
 * issue #3296. It parses the shipped stylesheet rather than restating the hex
 * values, so a token edited in tokens.css is what gets measured here.
 */

const TOKENS_CSS = path.join(__dirname, '..', 'src', 'pages', 'tokens.css');

const source = fs.readFileSync(TOKENS_CSS, 'utf8');

type Block = { open: number; close: number; text: string };

/** Slice one balanced `{ ... }` declaration block out of the stylesheet. */
const declarationBlock = (selector: RegExp): Block => {
  const start = source.search(selector);
  if (start < 0) throw new Error(`selector not found in tokens.css: ${selector}`);

  const open = source.indexOf('{', start);
  let depth = 0;
  let index = open;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return { open, close: index, text: source.slice(open, index) };
};

const customProperties = (block: string): Record<string, string> => {
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = match;
    if (name && value) found[`--${name}`] = value;
  }
  return found;
};

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const linearise = (value: number): number => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = channels(hex);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
};

const contrast = (a: string, b: string): number => {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
};

/** A missing token is a test failure, not an `undefined` quietly scored as a pass. */
const token = (tokens: Record<string, string>, name: string): string => {
  const value = tokens[name];
  if (value === undefined) throw new Error(`tokens.css does not define ${name}`);
  return value;
};

/**
 * tokens.css resolves to four palettes, not two. `:root` is the base; the three
 * override blocks are partial, so each palette is the base with its own block
 * applied on top - exactly how the cascade resolves it in the renderer.
 * `@media (prefers-color-scheme: dark)` is what a user who never opens the theme
 * toggle gets, so it has to be measured in its own right.
 */
const OVERRIDE_SELECTORS = {
  'dark (prefers-color-scheme)': /:root:not\(\[data-theme='light'\]\)/,
  "dark (forced data-theme='dark')": /^\[data-theme='dark'\]/m,
  "light (forced data-theme='light')": /^\[data-theme='light'\]/m,
} as const;

const base = declarationBlock(/^:root\s*\{/m);
const baseTokens = customProperties(base.text);

const overrideBlocks = Object.entries(OVERRIDE_SELECTORS).map(([name, selector]) => ({
  name,
  block: declarationBlock(selector),
}));

const PALETTES: Array<[string, Record<string, string>]> = [
  ['light (default :root)', baseTokens],
  ...overrideBlocks.map(
    ({ name, block }) =>
      [name, { ...baseTokens, ...customProperties(block.text) }] as [string, Record<string, string>]
  ),
];

/** Every block this suite actually reads, as source ranges. */
const MEASURED_RANGES = [base, ...overrideBlocks.map(({ block }) => block)].map(
  ({ open, close }) => [open, close] as const
);

/** Every surface a shell page paints text onto. */
const SURFACES = ['--screen', '--screen-2', '--page', '--inset', '--pill-raised'] as const;

/** Tokens used as `color:` on those surfaces. --ink-faint2 is excluded: its one
 *  use is a 34px decorative empty-state glyph, which WCAG 1.4.11 exempts. */
const TEXT_TOKENS = [
  '--ink',
  '--ink-body',
  '--ink-soft',
  '--ink-muted',
  '--ink-faint',
  '--blue-text',
] as const;

/** The tokens whose value this suite asserts on, in any palette. */
const GUARDED_TOKENS = [...SURFACES, ...TEXT_TOKENS, '--blue', '--divider'] as const;

const AA_SMALL_TEXT = 4.5;
const NON_TEXT = 3;

/** #3296 shipped dark --inset #3c332a on --screen #2f271e, a 1.19:1 step; the bug
 *  was #302820 on the same screen, 1.01:1. This floor is fixed rather than derived
 *  from the light theme's own step, because a derived bar can be lowered by
 *  flattening the theme it is read from. */
const INSET_STEP = 1.1;

describe('desktop shell colour tokens', () => {
  test('the stylesheet parser reads every palette', () => {
    // Without this the suite would pass vacuously on an empty parse.
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(PALETTES).toHaveLength(4);
    for (const [name, tokens] of PALETTES) {
      expect(Object.keys(tokens).length).toBeGreaterThan(15);
      expect(`${name}: ${token(tokens, '--ink-faint')}`).toMatch(/#[0-9a-f]{6}$/);
    }
    // The four palettes are not all the same palette.
    expect(new Set(PALETTES.map(([, t]) => t['--screen'])).size).toBe(2);
  });

  test('no guarded token is declared in a block this suite does not read', () => {
    // #3296 came back green once because the gate named two of the four theme
    // blocks. Deriving the coverage means a fifth block, or a value moved out of
    // a measured one, fails here instead of passing silently.
    const inMeasuredBlock = (offset: number): boolean =>
      MEASURED_RANGES.some(([open, close]) => offset > open && offset < close);

    const strays: string[] = [];
    for (const name of GUARDED_TOKENS) {
      for (const match of source.matchAll(new RegExp(`${name}:\\s*#[0-9a-fA-F]{6}`, 'g'))) {
        const offset = match.index ?? -1;
        if (!inMeasuredBlock(offset)) {
          strays.push(`${name} at line ${source.slice(0, offset).split('\n').length}`);
        }
      }
    }
    expect(strays).toEqual([]);

    // And the guard above is live: it can see the declarations inside the blocks.
    expect([...source.matchAll(/--ink-faint:/g)]).toHaveLength(MEASURED_RANGES.length);
  });

  describe.each(PALETTES)('%s', (_palette, tokens) => {
    test.each(TEXT_TOKENS)('%s reaches AA on every surface', (textToken) => {
      for (const surface of SURFACES) {
        expect(contrast(token(tokens, textToken), token(tokens, surface))).toBeGreaterThanOrEqual(
          AA_SMALL_TEXT
        );
      }
    });

    test('inset panels are visibly stepped off the screen', () => {
      // #3296: dark --inset was #302820 against --screen #2f271e, 1.01:1, so vault
      // thumbnails, the preview boxes and the palette icon tiles had no visible
      // surface.
      expect(contrast(token(tokens, '--inset'), token(tokens, '--screen'))).toBeGreaterThanOrEqual(
        INSET_STEP
      );
    });

    test('the toggle ring and the on state both clear the non-text minimum', () => {
      // .slider carries its off state as an inset --ink-faint ring on a --screen
      // group card; the on state is --blue.
      expect(
        contrast(token(tokens, '--ink-faint'), token(tokens, '--screen'))
      ).toBeGreaterThanOrEqual(NON_TEXT);
      expect(contrast(token(tokens, '--blue'), token(tokens, '--screen'))).toBeGreaterThanOrEqual(
        NON_TEXT
      );
    });

    test('--divider is not what makes a control visible', () => {
      // The bug was --divider used as the whole off-state fill: 1.37:1 light and
      // 1.15:1 dark. It is still the right colour for a rule between rows, so it
      // is not required to reach 3:1 - this pins why it cannot carry a control.
      expect(contrast(token(tokens, '--divider'), token(tokens, '--screen'))).toBeLessThan(
        NON_TEXT
      );
    });
  });

  test('the controls that were invisible carry their own contrast in the stylesheet', () => {
    // Token values alone cannot show this: if the ring were deleted from
    // settings.css the ratios above would still pass, so the rule is read here.
    const settingsCss = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'pages', 'settings.css'),
      'utf8'
    );

    const sliderBlock = /\.slider\s*\{([^}]*)\}/.exec(settingsCss)?.[1] ?? '';
    expect(sliderBlock).toContain('box-shadow: inset 0 0 0 1px var(--ink-faint)');

    const fontScaleBlock = /#fontScale\s*\{([^}]*)\}/.exec(settingsCss)?.[1] ?? '';
    expect(fontScaleBlock).toContain('background: var(--ink-faint)');
    expect(fontScaleBlock).not.toContain('background: var(--divider)');
  });

  test('--font-display only names faces the app can actually load', () => {
    // Newsreader led this list but is not shipped, so headings silently fell
    // through to Georgia. resources/fonts carries Satoshi only.
    const declaration = /--font-display:\s*([^;]+);/.exec(source);
    // Positive first: an unmatched regex must not satisfy the negative below by
    // yielding an empty string.
    expect(declaration).not.toBeNull();
    const fontDisplay = declaration?.[1] ?? '';
    expect(fontDisplay).toMatch(/serif/);
    expect(fontDisplay).not.toMatch(/Newsreader/i);

    const fontFaces = [...source.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(fontFaces).toContain('Satoshi Variable');
  });
});
