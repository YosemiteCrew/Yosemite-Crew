import {
  CALCULATORS,
  CALCULATOR_CATEGORIES,
  CALCULATOR_REFERENCES,
  calculatorsInCategory,
  type CalculatorConfig,
} from '@/app/features/calculators/registry';

const byKey = (key: string): CalculatorConfig => {
  const found = CALCULATORS.find((calc) => calc.key === key);
  if (!found) throw new Error(`missing config ${key}`);
  return found;
};

const CASES: Array<{ key: string; values: Record<string, string>; contains: string }> = [
  {
    key: 'fluid-rate',
    values: { weightKg: '10', dehydrationPercent: '5', ongoingLossesMlPerDay: '100' },
    contains: '600 mL/day',
  },
  {
    key: 'cri',
    values: {
      doseMcgPerKgMin: '2',
      weightKg: '20',
      bagVolumeMl: '500',
      fluidRateMlPerHr: '10',
      drugConcentrationMgPerMl: '50',
    },
    contains: '120 mg',
  },
  {
    key: 'shock-bolus',
    values: { weightKg: '20', doseMlPerKg: '20', minutes: '15' },
    contains: '400 mL',
  },
  {
    key: 'transfusion',
    values: { weightKg: '20', currentPcv: '15', targetPcv: '25', donorPcv: '40' },
    contains: '450 mL',
  },
  {
    key: 'drip-rate',
    values: { rateMlPerHr: '120', dropFactorGttPerMl: '20' },
    contains: '40 gtt/min',
  },
  {
    key: 'free-water-deficit',
    values: { weightKg: '20', currentNa: '170', targetNa: '150', bodyWaterFraction: '0.6' },
    contains: '1.6 L',
  },
  {
    key: 'drug-dose',
    values: { weightKg: '10', doseMgPerKg: '5', concentrationMgPerMl: '10', frequencyPerDay: '2' },
    contains: '5 mL',
  },
  { key: 'body-surface-area', values: { weightKg: '10', dosePerM2: '50' }, contains: '0.469 m²' },
  { key: 'concentration', values: { percentSolution: '2', doseMg: '50' }, contains: '20 mg/mL' },
  {
    key: 'corrected-sodium',
    values: { measuredNa: '140', glucoseMgDl: '600' },
    contains: '148 mEq/L',
  },
  {
    key: 'corrected-calcium',
    values: { totalCalciumMgDl: '8', albuminGdl: '2' },
    contains: '9.5 mg/dL',
  },
  { key: 'anion-gap', values: { na: '145', k: '4', cl: '110', hco3: '20' }, contains: '19 mEq/L' },
  {
    key: 'osmolality',
    values: { na: '145', k: '4', glucoseMgDl: '90', bunMgDl: '14', measuredOsm: '315' },
    contains: '308 mOsm/kg',
  },
  {
    key: 'energy',
    values: { weightKg: '10', merFactor: '1.6', dietKcalPer100g: '350' },
    contains: '394 kcal/day',
  },
  { key: 'iris-stage', values: { creatinineMgDl: '3.0' }, contains: 'Stage 3' },
  { key: 'blood-pressure', values: { sbpMmHg: '165' }, contains: 'Hypertensive' },
  { key: 'gestation', values: { breedingDate: '2026-01-01' }, contains: '2026-03-05' },
  {
    key: 'oxygen-flow',
    values: { weightKg: '10', flowMlPerKgPerMin: '100' },
    contains: '1000 mL/min',
  },
];

describe('calculator registry', () => {
  it('exposes all 18 calculators across 6 ordered categories', () => {
    expect(CALCULATORS).toHaveLength(18);
    expect(CALCULATOR_CATEGORIES).toEqual([
      'Fluids & emergency',
      'Dosing & pharmacy',
      'Electrolytes & metabolic',
      'Nutrition',
      'Renal & cardio',
      'Repro & anesthesia',
    ]);
  });

  it('groups calculators by category', () => {
    expect(calculatorsInCategory('Nutrition').map((calc) => calc.key)).toEqual(['energy']);
  });

  it.each(CASES)('computes $key with the expected result', ({ key, values, contains }) => {
    const rows = byKey(key).compute(values, 'dog');
    expect(rows.map((row) => row.value)).toContain(contains);
  });

  it('omits an optional row when the optional input is absent', () => {
    const rows = byKey('drug-dose').compute({ weightKg: '10', doseMgPerKg: '5' }, 'dog');
    expect(rows.some((row) => row.label === 'Volume per administration')).toBe(false);
  });

  it('surfaces engine validation errors', () => {
    expect(() => byKey('fluid-rate').compute({}, 'dog')).toThrow('Weight is required.');
  });
});

describe('calculator references', () => {
  it('attributes a non-empty formula source for every calculator', () => {
    CALCULATORS.forEach((calc) => {
      const ref = CALCULATOR_REFERENCES[calc.key];
      expect(ref).toBeDefined();
      expect(ref.source.length).toBeGreaterThan(0);
      if (ref.url) expect(ref.url).toMatch(/^https:\/\//);
    });
  });

  it('credits the genuine clinical source per formula', () => {
    expect(CALCULATOR_REFERENCES['iris-stage'].source).toMatch(/IRIS/);
    expect(CALCULATOR_REFERENCES['iris-stage'].url).toBe('https://www.iris-kidney.com');
    expect(CALCULATOR_REFERENCES['blood-pressure'].source).toMatch(/ACVIM/);
    expect(CALCULATOR_REFERENCES['corrected-sodium'].source).toMatch(/Katz/);
    expect(CALCULATOR_REFERENCES['energy'].source).toMatch(/WSAVA/);
    expect(CALCULATOR_REFERENCES['fluid-rate'].source).toMatch(/DiBartola/);
  });

  it('does not attribute any calculator to a third-party calculator suite', () => {
    CALCULATORS.forEach((calc) => {
      expect(CALCULATOR_REFERENCES[calc.key].source).not.toMatch(/Vetcalculators/i);
    });
  });
});
