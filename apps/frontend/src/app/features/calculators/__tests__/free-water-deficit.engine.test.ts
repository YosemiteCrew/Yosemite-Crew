import { calculateFreeWaterDeficit } from '@/app/features/calculators/engine/free-water-deficit';

describe('calculateFreeWaterDeficit', () => {
  it('computes deficit and correction time with the worked example', () => {
    const r = calculateFreeWaterDeficit({
      weightKg: 20,
      currentNa: 170,
      targetNa: 150,
    });
    expect(r.freeWaterDeficitL).toBeCloseTo(1.6, 2);
    expect(r.correctionHours).toBe(40);
  });

  it('uses the default body water fraction when absent', () => {
    const r = calculateFreeWaterDeficit({
      weightKg: 10,
      currentNa: 160,
      targetNa: 145,
    });
    // 0.6 * 10 * (160/145 - 1)
    expect(r.freeWaterDeficitL).toBeCloseTo(0.62, 2);
    expect(r.correctionHours).toBe(30);
  });

  it('uses a provided body water fraction when present', () => {
    const r = calculateFreeWaterDeficit({
      weightKg: 10,
      currentNa: 160,
      targetNa: 145,
      bodyWaterFraction: 0.5,
    });
    // 0.5 * 10 * (160/145 - 1)
    expect(r.freeWaterDeficitL).toBeCloseTo(0.52, 2);
    expect(r.correctionHours).toBe(30);
  });

  it('rejects a non-positive weight', () => {
    expect(() =>
      calculateFreeWaterDeficit({
        weightKg: 0,
        currentNa: 170,
        targetNa: 150,
      })
    ).toThrow('Weight must be greater than 0.');
  });

  it('rejects a current sodium outside the allowed range', () => {
    expect(() =>
      calculateFreeWaterDeficit({
        weightKg: 20,
        currentNa: 90,
        targetNa: 150,
      })
    ).toThrow('Current sodium must be between 100 and 200.');
  });

  it('rejects a target sodium outside the allowed range', () => {
    expect(() =>
      calculateFreeWaterDeficit({
        weightKg: 20,
        currentNa: 170,
        targetNa: 250,
      })
    ).toThrow('Target sodium must be between 100 and 200.');
  });

  it('rejects a body water fraction outside the allowed range when provided', () => {
    expect(() =>
      calculateFreeWaterDeficit({
        weightKg: 20,
        currentNa: 170,
        targetNa: 150,
        bodyWaterFraction: 0,
      })
    ).toThrow('Body water fraction must be between 0.4 and 0.8.');
  });

  it('rejects a target sodium that is not below the current sodium', () => {
    expect(() =>
      calculateFreeWaterDeficit({
        weightKg: 20,
        currentNa: 170,
        targetNa: 175,
      })
    ).toThrow('Target sodium must be below current sodium.');
  });

  it('rejects a target sodium equal to the current sodium', () => {
    expect(() =>
      calculateFreeWaterDeficit({
        weightKg: 20,
        currentNa: 170,
        targetNa: 170,
      })
    ).toThrow('Target sodium must be below current sodium.');
  });
});
