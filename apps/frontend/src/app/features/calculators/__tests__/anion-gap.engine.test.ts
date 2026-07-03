import { calculateAnionGap } from '@/app/features/calculators/engine/anion-gap';

describe('calculateAnionGap', () => {
  it('computes the anion gap from the worked example', () => {
    const r = calculateAnionGap({ na: 145, k: 4, cl: 110, hco3: 20 });
    expect(r.anionGap).toBe(19);
  });

  it('rounds the anion gap to 1 decimal place', () => {
    const r = calculateAnionGap({ na: 145.25, k: 4, cl: 110, hco3: 20 });
    expect(r.anionGap).toBeCloseTo(19.3, 1);
  });

  it('rejects a non-positive sodium', () => {
    expect(() => calculateAnionGap({ na: 0, k: 4, cl: 110, hco3: 20 })).toThrow(
      'Sodium must be greater than 0.'
    );
  });

  it('rejects a non-positive potassium', () => {
    expect(() => calculateAnionGap({ na: 145, k: 0, cl: 110, hco3: 20 })).toThrow(
      'Potassium must be greater than 0.'
    );
  });

  it('rejects a non-positive chloride', () => {
    expect(() => calculateAnionGap({ na: 145, k: 4, cl: 0, hco3: 20 })).toThrow(
      'Chloride must be greater than 0.'
    );
  });

  it('rejects a non-positive bicarbonate', () => {
    expect(() => calculateAnionGap({ na: 145, k: 4, cl: 110, hco3: 0 })).toThrow(
      'Bicarbonate must be greater than 0.'
    );
  });
});
