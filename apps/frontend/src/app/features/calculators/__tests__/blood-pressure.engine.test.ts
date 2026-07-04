import { classifyBloodPressure } from '@/app/features/calculators/engine/blood-pressure';

describe('classifyBloodPressure', () => {
  it('classifies a normotensive reading', () => {
    const r = classifyBloodPressure({ sbpMmHg: 135 });
    expect(r.category).toBe('Normotensive');
    expect(r.risk).toBe('Minimal');
  });

  it('classifies a prehypertensive reading', () => {
    const r = classifyBloodPressure({ sbpMmHg: 150 });
    expect(r.category).toBe('Prehypertensive');
    expect(r.risk).toBe('Low');
  });

  it('classifies a hypertensive reading', () => {
    const r = classifyBloodPressure({ sbpMmHg: 165 });
    expect(r.category).toBe('Hypertensive');
    expect(r.risk).toBe('Moderate');
  });

  it('classifies a severely hypertensive reading', () => {
    const r = classifyBloodPressure({ sbpMmHg: 185 });
    expect(r.category).toBe('Severely hypertensive');
    expect(r.risk).toBe('High');
  });

  it('treats the lower boundary of prehypertensive (140) correctly', () => {
    const r = classifyBloodPressure({ sbpMmHg: 140 });
    expect(r.category).toBe('Prehypertensive');
    expect(r.risk).toBe('Low');
  });

  it('treats the lower boundary of hypertensive (160) correctly', () => {
    const r = classifyBloodPressure({ sbpMmHg: 160 });
    expect(r.category).toBe('Hypertensive');
    expect(r.risk).toBe('Moderate');
  });

  it('treats the lower boundary of severely hypertensive (180) correctly', () => {
    const r = classifyBloodPressure({ sbpMmHg: 180 });
    expect(r.category).toBe('Severely hypertensive');
    expect(r.risk).toBe('High');
  });

  it('rejects a non-positive systolic blood pressure', () => {
    expect(() => classifyBloodPressure({ sbpMmHg: 0 })).toThrow(
      'Systolic blood pressure must be greater than 0.'
    );
  });
});
