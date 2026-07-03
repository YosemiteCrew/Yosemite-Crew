import { calculateIrisStage } from '@/app/features/calculators/engine/iris-stage';

describe('calculateIrisStage', () => {
  it('stages a nonazotemic dog as stage 1', () => {
    const r = calculateIrisStage({ species: 'dog', creatinineMgDl: 1.0 });
    expect(r.stage).toBe(1);
    expect(r.interpretation).toBe('Nonazotemic');
  });

  it('stages a dog with moderate azotemia as stage 3', () => {
    const r = calculateIrisStage({ species: 'dog', creatinineMgDl: 3.0 });
    expect(r.stage).toBe(3);
    expect(r.interpretation).toBe('Moderate renal azotemia');
  });

  it('uses the cat stage 1 threshold so 1.6 is stage 2', () => {
    const r = calculateIrisStage({ species: 'cat', creatinineMgDl: 1.6 });
    expect(r.stage).toBe(2);
    expect(r.interpretation).toBe('Mild renal azotemia');
  });

  it('stages a dog with severe azotemia as stage 4', () => {
    const r = calculateIrisStage({ species: 'dog', creatinineMgDl: 6.0 });
    expect(r.stage).toBe(4);
    expect(r.interpretation).toBe('Severe renal azotemia');
  });

  it('treats a cat below 1.6 as stage 1', () => {
    const r = calculateIrisStage({ species: 'cat', creatinineMgDl: 1.5 });
    expect(r.stage).toBe(1);
    expect(r.interpretation).toBe('Nonazotemic');
  });

  it('treats the dog stage 1 boundary value as stage 2', () => {
    const r = calculateIrisStage({ species: 'dog', creatinineMgDl: 1.4 });
    expect(r.stage).toBe(2);
    expect(r.interpretation).toBe('Mild renal azotemia');
  });

  it('treats creatinine just above the stage 2 ceiling as stage 3', () => {
    const r = calculateIrisStage({ species: 'cat', creatinineMgDl: 2.9 });
    expect(r.stage).toBe(3);
    expect(r.interpretation).toBe('Moderate renal azotemia');
  });

  it('rejects a non-positive creatinine', () => {
    expect(() => calculateIrisStage({ species: 'dog', creatinineMgDl: 0 })).toThrow(
      'Creatinine must be greater than 0.'
    );
  });

  it('rejects a missing creatinine', () => {
    expect(() => calculateIrisStage({ species: 'cat', creatinineMgDl: NaN })).toThrow(
      'Creatinine is required.'
    );
  });
});
