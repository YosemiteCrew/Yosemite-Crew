import {readFileSync, readdirSync, statSync} from 'fs';
import {join} from 'path';
import {colors, colorsDark} from '@/theme';

/**
 * `pink` (#FF90D4) is the decorative fill - icons, washes, the ink-annotation
 * ring. It measures 1.86:1 on the bone ground, which is fine for decoration and
 * well under the 3:1 WCAG 1.4.11 asks of anything that indicates STATE.
 *
 * Selection borders kept reaching for it anyway: the selected companion tile,
 * its avatar ring, the selected species card and the selected AER business card
 * all drew their "this one is chosen" edge at 1.86:1. `pinkDeep` exists for
 * exactly this - #C30077 on light (5.29:1 measured on device) and the true
 * brand pink on espresso, where it already clears the bar.
 */
const ALLOWED = new Set([
  // A static chip listing a companion, not a selection state - its text
  // carries the meaning and the border is decoration.
  'features/linkedBusinesses/screens/BusinessAddScreen.tsx',
]);

const SRC = join(__dirname, '..', '..', 'src');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

describe('pink as a state indicator', () => {
  it('keeps pinkDeep readable on light and brand pink on espresso', () => {
    expect(colors.pinkDeep).not.toBe(colors.pink);
    expect(colorsDark.pinkDeep).toBe(colorsDark.pink);
  });

  it('does not draw a border with the decorative pink', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = file.slice(SRC.length + 1);
      if (ALLOWED.has(rel)) {
        continue;
      }
      if (
        /borderColor:\s*(theme\.)?colors\.pink\b/.test(
          readFileSync(file, 'utf8'),
        )
      ) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
