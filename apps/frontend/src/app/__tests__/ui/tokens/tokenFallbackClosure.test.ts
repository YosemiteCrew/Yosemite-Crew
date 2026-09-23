/**
 * `var(--token, #literal)` is only ever one of two things, and both are bugs.
 *
 * If `--token` IS declared, the fallback is unreachable. It reads as a safety
 * net and is a second, unmaintained copy of the value: retint the token and the
 * literal stays where it was, which is exactly how a colour drifts from the
 * thing it was copied from.
 *
 * If `--token` is NOT declared, the fallback is what paints - in BOTH themes,
 * silently, with no error anywhere. That is the worse half, and it had shipped
 * three times when this test was written:
 *
 *   1. Both chat modals drew their backdrop from `var(--scrim, rgba(29,28,27,0.44))`.
 *      `--scrim` is declared nowhere. The canonical PIMS modal backdrop is
 *      `--sh55`, which goes rgba(29,28,27,0.55) light -> rgba(0,0,0,0.8) dark and
 *      has 25 other consumers, so the two modals were the only overlays in the
 *      app whose scrim did not respond to the theme at all.
 *   2. The forgot-password success badge drew `var(--success-soft, #e7f4ec)`
 *      under an ink that DID flip: 3.65:1 light, 2.13:1 dark, under the 3:1 a
 *      glyph needs.
 *   3. A story painted `var(--on-cta, #fff)` on `var(--cta)`. In dark `--cta` is
 *      the bone #f2ece1, so the pinned white was near-invisible while the
 *      declared `--cta-text` would have flipped to #201c18.
 *
 * None of the three produced a console warning, a failing test or a build
 * error. A missing custom property is not an error in CSS; it is a fallback,
 * and the fallback looked deliberate.
 *
 * Scope note: this asserts the CLOSURE (is the token declared), not the absence
 * of fallbacks. Removing an unreachable fallback is a separate, larger cleanup
 * tracked by scripts/ci/check-hardcoded-colours.mjs, which counts the literal.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SRC = path.join(root, 'src/app');

/** Every custom property declared by any stylesheet under src/app. */
const declaredProperties = (): Set<string> => {
  const declared = new Set<string>();
  for (const file of walk(SRC, ['.css'])) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
      declared.add(m[1]);
    }
  }
  return declared;
};

function walk(dir: string, extensions: string[], acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, extensions, acc);
    else if (extensions.some((ext) => full.endsWith(ext))) acc.push(full);
  }
  return acc;
}

/**
 * Blanks `/* ... *\/` so prose does not count as code.
 *
 * This file's own header quotes `var(--scrim, rgba(29,28,27,0.44))`, and so do
 * the source comments and Storybook `docs.description` strings that record why
 * each of these was wrong. A test that counted those would be satisfied by
 * deleting the explanations, which is the wrong direction.
 */
const withoutBlockComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));

const COLOUR_FALLBACK =
  /var\(\s*(--[a-zA-Z0-9-]+)\s*,\s*[^)]*(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/g;

describe('custom-property fallbacks', () => {
  const declared = declaredProperties();

  it('has a corpus and a vocabulary to check against', () => {
    // A closure test over an empty set of references passes for the wrong
    // reason, and so does one whose `declared` set came back empty - every
    // reference would then be a finding and the suite would be red, not
    // silently green. Both directions are pinned here.
    expect(declared.has('--sh55')).toBe(true);
    expect(declared.has('--cta-text')).toBe(true);
    expect(declared.has('--zz-not-a-token')).toBe(false);
    expect(declared.size).toBeGreaterThan(200);
  });

  it('never falls back to a colour literal for a token that is not declared', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC, ['.ts', '.tsx', '.css'])) {
      // Tests are excluded for the same reason the colour scanner excludes them:
      // a test asserting on a specific literal is a legitimate thing to write,
      // and this file plants the exact offending string three lines below.
      if (/__tests__/.test(file)) continue;
      const source = withoutBlockComments(fs.readFileSync(file, 'utf8'));
      source.split('\n').forEach((line, index) => {
        COLOUR_FALLBACK.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = COLOUR_FALLBACK.exec(line)) !== null) {
          if (declared.has(match[1])) continue;
          offenders.push(
            `${path.relative(root, file)}:${index + 1}  ${match[1]} is declared nowhere, ` +
              'so its literal fallback paints in both themes'
          );
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('finds a planted one, so the empty result above means something', () => {
    // The assertion above returning [] is indistinguishable from a matcher that
    // cannot match. This plants the exact shape of the shipped bug.
    const planted = withoutBlockComments(
      "const s = { background: 'var(--scrim, rgba(29,28,27,0.44))' };"
    );
    COLOUR_FALLBACK.lastIndex = 0;
    const match = COLOUR_FALLBACK.exec(planted);
    expect(match?.[1]).toBe('--scrim');
    expect(declared.has('--scrim')).toBe(false);

    // ...and does NOT fire on the same text inside a comment.
    const commented = withoutBlockComments(
      '/* was `var(--scrim, rgba(29,28,27,0.44))` before #2825 */'
    );
    COLOUR_FALLBACK.lastIndex = 0;
    expect(COLOUR_FALLBACK.exec(commented)).toBeNull();
  });
});
