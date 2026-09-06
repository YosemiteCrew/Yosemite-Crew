import {
  HEADER_PX,
  MIN_H_PX,
  TAB_BAR_PX,
  chooseProbeInset,
  describeInsetProbe,
  expectedShellHeight,
  measureConsentInsetResponse,
} from '@/app/features/appointments/pages/AppointmentWorkspace/phone/consentInsetAssertion';

/**
 * A shell whose height follows the calc the two phone shells use:
 *   100dvh - 54px - max(72px, --yc-consent-inset)
 * `responds` false models the shipped bug - the literal two-element sum, which
 * ignores the inset entirely.
 */
const fakeShell = (viewportHeight: number, { responds }: { responds: boolean }) => {
  let inset = 0;
  return {
    setInset: (value: string | null) => {
      inset = value === null ? 0 : Number.parseFloat(value);
    },
    shell: {
      getBoundingClientRect: () =>
        ({
          height:
            viewportHeight - HEADER_PX - (responds ? Math.max(TAB_BAR_PX, inset) : TAB_BAR_PX),
        }) as DOMRect,
    },
  };
};

describe('chooseProbeInset', () => {
  it('prefers 252px when the viewport can carry it above the floor', () => {
    expect(chooseProbeInset(844)).toEqual({ usable: true, inset: 252 });
  });

  it('shrinks the inset rather than letting the floor answer', () => {
    // 667 - 54 - 480 - 1 = 132, below the preferred 252 but still above the bar.
    expect(chooseProbeInset(667)).toEqual({ usable: true, inset: 132 });
  });

  it('refuses when no inset can beat the tab-bar term', () => {
    /* At 600px the largest inset that stays above the floor is 65, which loses
       to `max(72px, ...)` - so the calc would never be exercised and a pass
       would mean nothing. Refusing is the only honest answer. */
    const choice = chooseProbeInset(600);
    expect(choice.usable).toBe(false);
    expect(choice.inset).toBeLessThanOrEqual(TAB_BAR_PX);
    expect('reason' in choice && choice.reason).toContain('too short');
  });

  it('treats exactly the tab-bar width as unusable, not usable', () => {
    // inset === TAB_BAR_PX changes nothing under max(), so the boundary is <=.
    const height = HEADER_PX + MIN_H_PX + 1 + TAB_BAR_PX;
    expect(chooseProbeInset(height).usable).toBe(false);
  });
});

describe('expectedShellHeight', () => {
  it('derives from the viewport rather than a literal difference', () => {
    // 844 - 54 - 252. A literal `252 - 72` would encode env(safe-area) = 0.
    expect(expectedShellHeight(844, 252)).toBe(538);
    expect(expectedShellHeight(812, 252)).toBe(506);
  });
});

describe('measureConsentInsetResponse', () => {
  it('passes a shell that reserves the strip', () => {
    const { shell, setInset } = fakeShell(844, { responds: true });
    const result = measureConsentInsetResponse(shell, 844, setInset);
    expect(result.ok).toBe(true);
    expect(result.before).toBe(718);
    expect(result.withCard).toBe(538);
    expect(result.expected).toBe(538);
  });

  it('fails the shipped bug: a shell that ignores the inset', () => {
    const { shell, setInset } = fakeShell(844, { responds: false });
    const result = measureConsentInsetResponse(shell, 844, setInset);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('did not shrink');
    expect(result.withCard).toBe(result.before);
  });

  it('fails when the height moves but not to the derived value', () => {
    // Off by ten: shrinking is not the same as reserving the right strip.
    let inset = 0;
    const shell = {
      getBoundingClientRect: () =>
        ({
          height: 844 - HEADER_PX - Math.max(TAB_BAR_PX, inset) - (inset > 0 ? 10 : 0),
        }) as DOMRect,
    };
    const result = measureConsentInsetResponse(shell, 844, (v) => {
      inset = v === null ? 0 : Number.parseFloat(v);
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('is not the expected');
  });

  it('fails when a clamped shell reports the floor rather than the calc', () => {
    /* `chooseProbeInset` already prevents the floor from being the answer on a
       healthy shell - the inset is picked to clear it by 1px - so this models a
       shell that clamps its own height instead. The number it returns is
       plausible and produced by the wrong mechanism, which is precisely what a
       height assertion alone would accept. */
    let inset = 0;
    const shell = {
      getBoundingClientRect: () =>
        ({ height: Math.min(MIN_H_PX, 844 - HEADER_PX - Math.max(TAB_BAR_PX, inset)) }) as DOMRect,
    };
    const result = measureConsentInsetResponse(shell, 844, (v) => {
      inset = v === null ? 0 : Number.parseFloat(v);
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('floor answered');
  });

  it('refuses to report a pass on a viewport too short to exercise the calc', () => {
    const { shell, setInset } = fakeShell(600, { responds: true });
    const result = measureConsentInsetResponse(shell, 600, setInset);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('too short');
  });

  it('always clears the property it set, including on the refusing path', () => {
    const seen: Array<string | null> = [];
    const shell = { getBoundingClientRect: () => ({ height: 718 }) as DOMRect };
    measureConsentInsetResponse(shell, 844, (v) => seen.push(v));
    expect(seen[seen.length - 1]).toBeNull();

    seen.length = 0;
    measureConsentInsetResponse(shell, 600, (v) => seen.push(v));
    expect(seen[seen.length - 1] ?? null).toBeNull();
  });

  it('names the numbers in its description', () => {
    const { shell, setInset } = fakeShell(844, { responds: false });
    const result = measureConsentInsetResponse(shell, 844, setInset);
    expect(describeInsetProbe(result)).toBe(
      'consent inset 252px: before 718px, with card 718px, expected 538px - did not shrink: 718 is not less than 718; height 718 is not the expected 538'
    );
  });
});
