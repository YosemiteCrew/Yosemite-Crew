import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the desktop shell's colour tokens against the contrast regressions in
 * issue #3296. It parses the shipped stylesheet rather than restating the hex
 * values, so a token edited in tokens.css is what gets measured here.
 */

const TOKENS_CSS = path.join(__dirname, '..', 'src', 'pages', 'tokens.css');

const source = fs.readFileSync(TOKENS_CSS, 'utf8');

/** Slice one balanced `{ ... }` declaration block out of the stylesheet. */
const declarationBlock = (selector: RegExp): string => {
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
  return source.slice(open, index);
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

const light = customProperties(declarationBlock(/^:root/m));
const dark = customProperties(declarationBlock(/^\[data-theme='dark'\]/m));

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

const AA_SMALL_TEXT = 4.5;
const NON_TEXT = 3;

describe('desktop shell colour tokens', () => {
  test('the stylesheet parser reads both themes', () => {
    // Without this the suite would pass vacuously on an empty parse.
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(Object.keys(light).length).toBeGreaterThan(15);
    expect(Object.keys(dark).length).toBeGreaterThan(15);
    expect(token(light, '--ink-faint')).toMatch(/^#[0-9a-f]{6}$/);
    expect(token(dark, '--ink-faint')).toMatch(/^#[0-9a-f]{6}$/);
  });

  describe.each([
    ['light', light],
    ['dark', dark],
  ])('%s theme', (_theme, tokens) => {
    test.each(TEXT_TOKENS)('%s reaches AA on every surface', (textToken) => {
      for (const surface of SURFACES) {
        expect(contrast(token(tokens, textToken), token(tokens, surface))).toBeGreaterThanOrEqual(AA_SMALL_TEXT);
      }
    });

    test('inset panels are at least as distinct from the screen as the light theme is', () => {
      // #3296: dark --inset was #302820 against --screen #2f271e, 1.01:1, so vault
      // thumbnails, the preview boxes and the palette icon tiles had no visible
      // surface. The light theme's own inset step is the reference, not a number
      // invented here.
      const lightStep = contrast(token(light, '--inset'), token(light, '--screen'));
      expect(contrast(token(tokens, '--inset'), token(tokens, '--screen'))).toBeGreaterThanOrEqual(
        lightStep,
      );
    });

    test('the toggle ring and the on state both clear the non-text minimum', () => {
      // .slider carries its off state as an inset --ink-faint ring on a --screen
      // group card; the on state is --blue.
      expect(contrast(token(tokens, '--ink-faint'), token(tokens, '--screen'))).toBeGreaterThanOrEqual(
        NON_TEXT,
      );
      expect(contrast(token(tokens, '--blue'), token(tokens, '--screen'))).toBeGreaterThanOrEqual(
        NON_TEXT,
      );
    });

    test('--divider is not what makes a control visible', () => {
      // The bug was --divider used as the whole off-state fill: 1.37:1 light and
      // 1.15:1 dark. It is still the right colour for a rule between rows, so it
      // is not required to reach 3:1 - this pins why it cannot carry a control.
      expect(contrast(token(tokens, '--divider'), token(tokens, '--screen'))).toBeLessThan(NON_TEXT);
    });
  });

  test('the controls that were invisible carry their own contrast in the stylesheet', () => {
    // Token values alone cannot show this: if the ring were deleted from
    // settings.css the ratios above would still pass, so the rule is read here.
    const settingsCss = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'pages', 'settings.css'),
      'utf8',
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
    const fontDisplay = /--font-display:\s*([^;]+);/.exec(source)?.[1] ?? '';
    expect(fontDisplay).not.toMatch(/Newsreader/i);

    const fontFaces = [...source.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(fontFaces).toContain('Satoshi Variable');
  });
});
