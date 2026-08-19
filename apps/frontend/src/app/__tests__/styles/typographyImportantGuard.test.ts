/**
 * Guard: font-weight utilities must stay able to override the typography classes.
 *
 * globals.css used to carry an unlayered `.text-caption-2` twin plus unlayered
 * `.text-caption-3` / mobile-heading overrides that all used `font-weight: ... !important`.
 * In Tailwind v4 an unlayered rule beats the utilities layer regardless of !important, so
 * `font-bold` on a `text-caption-2` label (QuickActionsModal) silently did nothing. jsdom
 * does not apply globals.css, so a getComputedStyle render test cannot catch this - it is
 * asserted here against the source itself.
 *
 * If this fails: keep these overrides inside `@layer components` and drop `!important` from
 * every font-weight declaration. Size/line-height/family may keep !important for the
 * responsive mobile behavior.
 */
import { readFileSync } from 'fs';
import path from 'path';

const CSS_PATH = path.join(__dirname, '..', '..', 'globals.css');
const css = readFileSync(CSS_PATH, 'utf8');

/**
 * Walk the braces up to `index` and report the nearest still-open `@layer <name>`.
 * A plain `{` (or `@media {`) pushes `null` so nesting depth stays correct; the topmost
 * non-null entry is the layer the target sits inside.
 */
const enclosingLayer = (source: string, index: number): string | null => {
  const stack: (string | null)[] = [];
  for (let i = 0; i < index; i++) {
    const ch = source[i];
    if (ch === '{') {
      const match = /@layer\s+([\w-]+)\s*$/.exec(source.slice(0, i));
      stack.push(match ? match[1] : null);
    } else if (ch === '}') {
      stack.pop();
    }
  }
  return stack.filter((name) => name !== null).at(-1) ?? null;
};

describe('typography !important guard', () => {
  it('has no font-weight declaration marked !important', () => {
    const matches = css.match(/font-weight:[^;]*!important/g) ?? [];
    expect(matches).toEqual([]);
  });

  it('keeps exactly one .text-caption-2 block', () => {
    const matches = css.match(/\.text-caption-2\s*\{/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('nests .text-caption-3 inside @layer components', () => {
    const index = css.indexOf('.text-caption-3');
    expect(index).toBeGreaterThan(-1);
    expect(enclosingLayer(css, index)).toBe('components');
  });

  it('nests the mobile typography media block inside @layer components', () => {
    const index = css.indexOf('@media screen and (max-width: 768px)');
    expect(index).toBeGreaterThan(-1);
    expect(enclosingLayer(css, index)).toBe('components');
  });
});
