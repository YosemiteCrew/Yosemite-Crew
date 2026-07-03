import { calculateCorrectedSodium } from '@/app/features/calculators/engine/corrected-sodium';

describe('calculateCorrectedSodium', () => {
  it('corrects sodium for hyperglycemia', () => {
    const r = calculateCorrectedSodium({ measuredNa: 140, glucoseMgDl: 600 });
    expect(r.correctedNa).toBeCloseTo(148, 1);
  });

  it('returns the measured sodium when glucose is at the 100 mg/dL baseline', () => {
    const r = calculateCorrectedSodium({ measuredNa: 135, glucoseMgDl: 100 });
    expect(r.correctedNa).toBeCloseTo(135, 1);
  });

  it('rejects a measured sodium below the valid range', () => {
    expect(() => calculateCorrectedSodium({ measuredNa: 99, glucoseMgDl: 600 })).toThrow(
      'Measured sodium must be between 100 and 200.'
    );
  });

  it('rejects a measured sodium above the valid range', () => {
    expect(() => calculateCorrectedSodium({ measuredNa: 201, glucoseMgDl: 600 })).toThrow(
      'Measured sodium must be between 100 and 200.'
    );
  });

  it('rejects a non-positive glucose', () => {
    expect(() => calculateCorrectedSodium({ measuredNa: 140, glucoseMgDl: 0 })).toThrow(
      'Glucose must be greater than 0.'
    );
  });
});
