/**
 * Shared by the two phone-only shells, which size themselves with the same calc
 * and would otherwise be one tested shell and one untested copy of it.
 *
 * There are three fixed things on a phone, not two: the header, the tab bar,
 * and the consent card, which publishes the strip it denies as
 * `--yc-consent-inset`. The shells used a literal `72px + env(...)` sum, so they
 * kept full height while the card sat over the bottom of them.
 *
 * The measurement is split from the assertion so it can be unit-tested: a probe
 * that silently stops discriminating is worse than no probe, and one whose only
 * consumer is a play function is never exercised by the coverage gate.
 */

/** Height of the phone header the shells subtract. */
export const HEADER_PX = 54;
/** The floor both shells carry alongside the calc. */
export const MIN_H_PX = 480;
/** The tab-bar reserve the inset already contains, hence `max` and not a sum. */
export const TAB_BAR_PX = 72;

const PREFERRED_INSET_PX = 252;

export type InsetChoice =
  { usable: true; inset: number } | { usable: false; inset: number; reason: string };

/**
 * The inset to probe with.
 *
 * It has to beat the tab-bar TERM the CSS actually competes with -
 * `TAB_BAR_PX + envInsetPx`, not the bare `TAB_BAR_PX` - or the `max()`
 * returns the tab-bar term and the calc is never exercised. It also has to
 * stay above `MIN_H_PX` (or the floor answers instead of the calc, which
 * passes while measuring the wrong mechanism).
 *
 * `envInsetPx` defaults to 0, matching `env(safe-area-inset-bottom)` in a
 * headless browser; a real device with a home indicator resolves it higher,
 * which shrinks the usable band from the tab-bar end.
 */
export const chooseProbeInset = (viewportHeight: number, envInsetPx = 0): InsetChoice => {
  const inset = Math.min(PREFERRED_INSET_PX, viewportHeight - HEADER_PX - MIN_H_PX - 1);
  const tabBarTerm = TAB_BAR_PX + envInsetPx;
  if (inset <= tabBarTerm) {
    return {
      usable: false,
      inset,
      reason: `viewport ${viewportHeight}px is too short to exercise the calc above the ${MIN_H_PX}px floor: the largest usable inset is ${inset}px, which does not beat the ${tabBarTerm}px tab-bar term (${TAB_BAR_PX}px bar + ${envInsetPx}px safe-area inset)`,
    };
  }
  return { usable: true, inset };
};

/**
 * Expected shell height once the strip is reserved.
 *
 * Derived rather than written as a literal difference: a literal `252 - 72`
 * silently encodes `env(safe-area-inset-bottom) = 0`, true in a headless browser
 * and false on any device with a home indicator, where the real delta is
 * smaller.
 */
export const expectedShellHeight = (viewportHeight: number, inset: number): number =>
  viewportHeight - HEADER_PX - inset;

export type InsetProbeResult = {
  ok: boolean;
  reason?: string;
  inset: number;
  before: number;
  withCard: number;
  restored: number;
  expected: number;
};

type Shell = Pick<HTMLElement, 'getBoundingClientRect'>;

/**
 * Reads the safe-area inset the CSS `max()` term actually competes with,
 * instead of assuming it is 0. jsdom does not evaluate `env()` (padding-bottom
 * resolves empty, hence the finite-or-0 fallback), so this is only a real
 * measurement under an engine that does - Storybook's Playwright runner.
 */
export const resolveEnvInsetPx = (): number => {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  document.body.appendChild(probe);
  const parsed = Number.parseFloat(globalThis.getComputedStyle(probe).paddingBottom);
  probe.remove();
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Sets the inset, reads the shell, and puts it back. Returns what it saw rather
 * than asserting, so the discrimination itself can be tested.
 */
export const measureConsentInsetResponse = (
  shell: Shell,
  viewportHeight: number,
  setInset: (value: string | null) => void,
  envInsetPx = 0
): InsetProbeResult => {
  const before = shell.getBoundingClientRect().height;
  const choice = chooseProbeInset(viewportHeight, envInsetPx);
  const expected = expectedShellHeight(viewportHeight, choice.inset);

  if (!choice.usable) {
    return {
      ok: false,
      reason: choice.reason,
      inset: choice.inset,
      before,
      withCard: before,
      restored: before,
      expected,
    };
  }

  try {
    setInset(`${choice.inset}px`);
    const withCard = shell.getBoundingClientRect().height;
    setInset('0px');
    const restored = shell.getBoundingClientRect().height;

    const shrank = withCard < before;
    const matched = Math.round(withCard) === expected;
    const clearedFloor = Math.round(withCard) > MIN_H_PX;
    const returned = Math.round(restored) === Math.round(before);

    const failures: string[] = [];
    if (!shrank) failures.push(`did not shrink: ${withCard} is not less than ${before}`);
    if (!matched) failures.push(`height ${Math.round(withCard)} is not the expected ${expected}`);
    if (!clearedFloor)
      failures.push(
        `height ${Math.round(withCard)} is at or below the ${MIN_H_PX}px floor, so the floor answered rather than the calc`
      );
    if (!returned)
      failures.push(
        `did not return to ${Math.round(before)} at inset 0, saw ${Math.round(restored)}`
      );

    return {
      ok: failures.length === 0,
      reason: failures.length > 0 ? failures.join('; ') : undefined,
      inset: choice.inset,
      before,
      withCard,
      restored,
      expected,
    };
  } finally {
    setInset(null);
  }
};

/** Describes a result for an assertion message that has to explain itself. */
export const describeInsetProbe = (result: InsetProbeResult): string =>
  `consent inset ${result.inset}px: before ${Math.round(result.before)}px, with card ${Math.round(result.withCard)}px, expected ${result.expected}px - ${result.reason ?? 'ok'}`;
