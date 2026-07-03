import { calculateOsmolality } from '@/app/features/calculators/engine/osmolality';

describe('calculateOsmolality', () => {
  it('computes calculated osmolality and returns null gap without measured value', () => {
    const r = calculateOsmolality({ na: 145, k: 4, glucoseMgDl: 90, bunMgDl: 14 });
    expect(r.calculatedOsm).toBeCloseTo(308, 1);
    expect(r.osmolalGap).toBeNull();
  });

  it('computes the osmolal gap when measured osmolality is provided', () => {
    const r = calculateOsmolality({
      na: 145,
      k: 4,
      glucoseMgDl: 90,
      bunMgDl: 14,
      measuredOsm: 315,
    });
    expect(r.calculatedOsm).toBeCloseTo(308, 1);
    expect(r.osmolalGap).toBeCloseTo(7, 1);
  });

  it('rejects a non-positive sodium', () => {
    expect(() => calculateOsmolality({ na: 0, k: 4, glucoseMgDl: 90, bunMgDl: 14 })).toThrow(
      'Sodium must be greater than 0.'
    );
  });

  it('rejects a non-positive potassium', () => {
    expect(() => calculateOsmolality({ na: 145, k: 0, glucoseMgDl: 90, bunMgDl: 14 })).toThrow(
      'Potassium must be greater than 0.'
    );
  });

  it('rejects a non-positive glucose', () => {
    expect(() => calculateOsmolality({ na: 145, k: 4, glucoseMgDl: 0, bunMgDl: 14 })).toThrow(
      'Glucose must be greater than 0.'
    );
  });

  it('rejects a non-positive BUN', () => {
    expect(() => calculateOsmolality({ na: 145, k: 4, glucoseMgDl: 90, bunMgDl: 0 })).toThrow(
      'BUN must be greater than 0.'
    );
  });

  it('rejects a non-positive measured osmolality when provided', () => {
    expect(() =>
      calculateOsmolality({ na: 145, k: 4, glucoseMgDl: 90, bunMgDl: 14, measuredOsm: 0 })
    ).toThrow('Measured osmolality must be greater than 0.');
  });
});
