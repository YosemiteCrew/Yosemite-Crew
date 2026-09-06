import {
  compositeOver,
  describeContrast,
  measureContrast,
} from '@/app/features/appointments/components/Calendar/responsive/contrastProbe';

/**
 * The probe decides whether a contrast assertion passes, so a wrong probe is
 * worse than no probe: it reports a number with the same confidence either way.
 * These pin the compositing, which is the part that was wrong first time round.
 */
describe('compositeOver', () => {
  it('accumulates alpha instead of jumping to opaque', () => {
    /* The original hardcoded `a: 1`. That made `effectiveBackground`'s
       `a >= 0.999` guard true after ONE blend, so a walk up two translucent
       ancestors stopped at the second and called it the backdrop. */
    const half = compositeOver({ r: 255, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 255, a: 0.5 });
    expect(half.a).toBeCloseTo(0.75, 5);
    expect(half.a).toBeLessThan(0.999);
  });

  it('un-premultiplies the colour channels against a translucent backdrop', () => {
    // 50% red over 50% blue: ao = 0.75, r = (255*.5)/.75 = 170, b = (255*.25)/.75 = 85.
    // Weighting by (1 - as) alone - the original - gives 127.5/127.5, which is
    // the backdrop over-counted because it is not fully there.
    const blended = compositeOver({ r: 255, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 255, a: 0.5 });
    expect(blended.r).toBeCloseTo(170, 4);
    expect(blended.b).toBeCloseTo(85, 4);
    expect(blended.g).toBeCloseTo(0, 4);
  });

  it('is unchanged for the common case of a translucent ink on an opaque fill', () => {
    // This is the path the shipped assertions take, so it must not move.
    const ink = compositeOver({ r: 255, g: 255, b: 255, a: 0.75 }, { r: 37, g: 123, b: 237, a: 1 });
    expect(ink.a).toBe(1);
    expect(ink.r).toBeCloseTo(200.5, 4);
    expect(ink.g).toBeCloseTo(222, 4);
    expect(ink.b).toBeCloseTo(250.5, 4);
  });

  it('reports nothing rather than dividing by zero when both layers are absent', () => {
    expect(compositeOver({ r: 1, g: 2, b: 3, a: 0 }, { r: 4, g: 5, b: 6, a: 0 }).a).toBe(0);
  });
});

describe('measureContrast', () => {
  const mount = (color: string, background: string, extra: Partial<CSSStyleDeclaration> = {}) => {
    const parent = document.createElement('div');
    parent.style.backgroundColor = background;
    const el = document.createElement('span');
    el.style.color = color;
    el.style.fontSize = (extra.fontSize as string) ?? '14px';
    el.style.fontWeight = (extra.fontWeight as string) ?? '700';
    el.textContent = 'x';
    parent.appendChild(el);
    document.body.appendChild(parent);
    return el;
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reproduces the shipped failure: white on --blue at 14px/700', () => {
    const reading = measureContrast(mount('rgb(255, 255, 255)', 'rgb(37, 123, 237)'));
    expect(reading.ratio).toBe(4.09);
    expect(reading.required).toBe(4.5);
    expect(reading.passes).toBe(false);
  });

  it('reproduces the fix: white on --blue-strong, both themes', () => {
    expect(measureContrast(mount('rgb(255, 255, 255)', 'rgb(22, 87, 201)')).ratio).toBe(6.48);
    expect(measureContrast(mount('rgb(255, 255, 255)', 'rgb(47, 116, 217)')).ratio).toBe(4.54);
  });

  it('resolves a translucent ink rather than reading it as opaque', () => {
    // 2.98:1, not the 4.09:1 an opaque reading gives - the difference between
    // failing and looking like the row next to it.
    const reading = measureContrast(
      mount('rgba(255, 255, 255, 0.75)', 'rgb(37, 123, 237)', { fontSize: '9px' })
    );
    expect(reading.ratio).toBe(2.98);
    expect(reading.passes).toBe(false);
  });

  it('holds the WCAG-large boundary at 18.66px bold, so 14px/700 needs 4.5', () => {
    expect(
      measureContrast(mount('rgb(0,0,0)', 'rgb(255,255,255)', { fontSize: '14px' })).required
    ).toBe(4.5);
    expect(
      measureContrast(mount('rgb(0,0,0)', 'rgb(255,255,255)', { fontSize: '18.66px' })).required
    ).toBe(3);
    expect(
      measureContrast(
        mount('rgb(0,0,0)', 'rgb(255,255,255)', {
          fontSize: '18px',
          fontWeight: '400',
        })
      ).required
    ).toBe(4.5);
  });

  it('names the measured colours in the failure message', () => {
    const reading = measureContrast(mount('rgb(255, 255, 255)', 'rgb(37, 123, 237)'));
    expect(describeContrast('Start visit pill', reading)).toBe(
      'Start visit pill: 4.09:1 (needs 4.5:1) - rgb(255, 255, 255) on rgb(37, 123, 237) at 14px/700'
    );
  });
});
