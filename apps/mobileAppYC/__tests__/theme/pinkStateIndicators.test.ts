import {findSourceFilesMatching} from '../setup/sourceScan';
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

describe('pink as a state indicator', () => {
  it('keeps pinkDeep readable on light and brand pink on espresso', () => {
    expect(colors.pinkDeep).not.toBe(colors.pink);
    expect(colorsDark.pinkDeep).toBe(colorsDark.pink);
  });

  it('does not draw a border with the decorative pink', () => {
    const offenders = findSourceFilesMatching(
      [/borderColor:\s*(theme\.)?colors\.pink\b/],
      ALLOWED,
    );
    expect(offenders).toEqual([]);
  });
});
