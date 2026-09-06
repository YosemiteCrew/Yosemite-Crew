import { expect } from 'storybook/test';

/**
 * Shared by the two phone-only shells, which size themselves with the same calc
 * and would otherwise be one tested shell and one untested copy of it.
 *
 * There are three fixed things on a phone, not two: the header, the tab bar,
 * and the consent card, which publishes the strip it denies as
 * `--yc-consent-inset`. The shells used a literal `72px + env(...)` sum, so they
 * kept full height while the card sat over the bottom of them.
 */
const HEADER_PX = 54;
const MIN_H_PX = 480;

/**
 * Asserts the shell reserves the consent strip.
 *
 * The expected height is derived from `innerHeight` rather than written as a
 * literal difference: a literal `252 - 72` silently encodes
 * `env(safe-area-inset-bottom) = 0`, which is true in a headless browser and
 * false on any device with a home indicator, where the real delta is smaller.
 * Comparing against `innerHeight - HEADER - inset` is exact on both.
 *
 * The chosen inset must also clear `min-h-[480px]`, or the floor answers instead
 * of the calc and the assertion passes without exercising anything. That floor
 * is deliberate - below it a clinical workspace is unusable, and since the page
 * can scroll (unlike the old `100svh`) content stays reachable rather than
 * lost - so it is asserted here rather than worked around.
 */
export const expectShellReservesConsentInset = async (shell: HTMLElement) => {
  const root = document.documentElement;
  const before = shell.getBoundingClientRect().height;

  // Big enough to beat 72px + any env inset, small enough to stay above the floor.
  const inset = Math.min(252, window.innerHeight - HEADER_PX - MIN_H_PX - 1);
  await expect(
    inset,
    `viewport ${window.innerHeight}px is too short to exercise the calc above the ${MIN_H_PX}px floor`
  ).toBeGreaterThan(72);

  try {
    root.style.setProperty('--yc-consent-inset', `${inset}px`);
    const withCard = shell.getBoundingClientRect().height;

    await expect(withCard).toBeLessThan(before);
    await expect(Math.round(withCard)).toBe(window.innerHeight - HEADER_PX - inset);
    // The floor is not what produced that number.
    await expect(Math.round(withCard)).toBeGreaterThan(MIN_H_PX);

    root.style.setProperty('--yc-consent-inset', '0px');
    await expect(Math.round(shell.getBoundingClientRect().height)).toBe(Math.round(before));
  } finally {
    root.style.removeProperty('--yc-consent-inset');
  }
};
