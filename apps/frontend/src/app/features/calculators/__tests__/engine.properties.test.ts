// Property-based tests for the dosing and fluid engines.
//
// The example-based suites next to this one pin specific clinical cases: a 20 kg
// dog on a named protocol produces a named number. That catches a wrong formula,
// but it cannot catch the failures that matter most here, because those only
// appear away from the examples someone thought to write down. A dose that goes
// non-monotonic at the top of the weight range, a division that yields Infinity
// for an input the form actually permits, a NaN that renders as a blank field
// beside the word "mg" - each is a plausible number produced for a real patient,
// and each survives an example suite indefinitely.
//
// So these tests assert the properties that must hold across the whole
// physiologic input space rather than at chosen points:
//
//   totality      every accepted input yields finite numbers, never NaN or
//                 Infinity, because a drug volume of Infinity must never reach
//                 a syringe
//   monotonicity  more weight or a higher dose rate never yields less drug;
//                 a faster fluid rate never makes a bag last longer
//   rejection     inputs outside the physiologic range are refused with a typed
//                 CalculatorInputError, not silently computed
//
// Ranges are chosen to span real veterinary practice: 0.1 kg covers a neonatal
// kitten, 90 kg a giant-breed dog.
//
// Rounding makes every monotonicity property NON-strict. Two weights a gram
// apart legitimately round to the same displayed dose, so these assert `>=`
// rather than `>`; asserting strict growth would fail on correct code.

import fc from 'fast-check';

import { calculateConcentration } from '@/app/features/calculators/engine/concentration';
import { calculateCri } from '@/app/features/calculators/engine/cri';
import { calculateDripRate } from '@/app/features/calculators/engine/drip-rate';
import { calculateEnergyRequirement } from '@/app/features/calculators/engine/energy';
import { CalculatorInputError, roundTo } from '@/app/features/calculators/utils/shared';
import { lbsToKg } from '@/app/features/calculators/utils/units';

// Bounded, non-fractional-noise generators. `noNaN`/`noDefaultInfinity` keep the
// arbitrary inside the domain the engines document as valid, so a failure means
// the engine mishandled a legitimate input rather than that the test fed it
// something the form would have rejected first.
const weightKg = fc.double({ min: 0.1, max: 90, noNaN: true, noDefaultInfinity: true });
const positive = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

const isFiniteNumber = (value: number) => typeof value === 'number' && Number.isFinite(value);

// Non-positive and non-finite values every engine must refuse. -0 is included on
// purpose: it is <= 0, so it must be rejected, but a `value < 0` check would let
// it through and produce a zero dose.
const invalidInputs = [0, -0, -1, -0.0001, Number.NaN, Number.POSITIVE_INFINITY, -Infinity];

describe('shared primitives', () => {
  it('roundTo never invents a value, and stays within half a unit of the last place', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 0, max: 6 }),
        (value, decimals) => {
          const rounded = roundTo(value, decimals);
          expect(Number.isFinite(rounded)).toBe(true);
          expect(Math.abs(rounded - value)).toBeLessThanOrEqual(0.5 * 10 ** -decimals);
        }
      )
    );
  });

  it('roundTo is monotonic, so rounding never reorders two doses', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e5, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 1e5, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 0, max: 4 }),
        (a, b, decimals) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          expect(roundTo(high, decimals)).toBeGreaterThanOrEqual(roundTo(low, decimals));
        }
      )
    );
  });
});

describe('lbsToKg', () => {
  it('is order-preserving and finite across recorded patient weights', () => {
    fc.assert(
      fc.property(positive(0.1, 250), positive(0.1, 250), (a, b) => {
        expect(isFiniteNumber(lbsToKg(a))).toBe(true);
        const [low, high] = a <= b ? [a, b] : [b, a];
        expect(lbsToKg(high)).toBeGreaterThanOrEqual(lbsToKg(low));
      })
    );
  });

  it('round-trips back to the original pounds within the rounding it applies', () => {
    // The conversion rounds to two decimal places of kilograms, so a round trip
    // can only be asserted to that tolerance, scaled back into pounds.
    fc.assert(
      fc.property(positive(1, 250), (lbs) => {
        const backToLbs = lbsToKg(lbs) * 2.20462;
        expect(Math.abs(backToLbs - lbs)).toBeLessThanOrEqual(0.02);
      })
    );
  });
});

describe('calculateEnergyRequirement', () => {
  it('produces finite energy figures for every valid weight', () => {
    fc.assert(
      fc.property(weightKg, fc.option(positive(0.8, 3), { nil: undefined }), (kg, merFactor) => {
        const result = calculateEnergyRequirement({ weightKg: kg, merFactor });
        expect(isFiniteNumber(result.rerKcalPerDay)).toBe(true);
        expect(isFiniteNumber(result.merKcalPerDay)).toBe(true);
        expect(result.rerKcalPerDay).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it('never returns less energy for a heavier patient', () => {
    fc.assert(
      fc.property(weightKg, weightKg, (a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        const lighter = calculateEnergyRequirement({ weightKg: low });
        const heavier = calculateEnergyRequirement({ weightKg: high });
        expect(heavier.rerKcalPerDay).toBeGreaterThanOrEqual(lighter.rerKcalPerDay);
        expect(heavier.merKcalPerDay).toBeGreaterThanOrEqual(lighter.merKcalPerDay);
      })
    );
  });

  it('keeps maintenance at or above resting whenever the factor is at least 1', () => {
    fc.assert(
      fc.property(weightKg, positive(1, 3), (kg, merFactor) => {
        const result = calculateEnergyRequirement({ weightKg: kg, merFactor });
        expect(result.merKcalPerDay).toBeGreaterThanOrEqual(result.rerKcalPerDay);
      })
    );
  });

  it('reports grams per day only when a diet density is supplied', () => {
    fc.assert(
      fc.property(weightKg, fc.option(positive(50, 600), { nil: undefined }), (kg, density) => {
        const result = calculateEnergyRequirement({ weightKg: kg, dietKcalPer100g: density });
        if (density === undefined) {
          expect(result.gramsPerDay).toBeNull();
        } else {
          expect(isFiniteNumber(result.gramsPerDay as number)).toBe(true);
          expect(result.gramsPerDay as number).toBeGreaterThanOrEqual(0);
        }
      })
    );
  });

  it.each(invalidInputs)('refuses weight %p with a typed error', (weight) => {
    expect(() => calculateEnergyRequirement({ weightKg: weight })).toThrow(CalculatorInputError);
  });
});

describe('calculateCri', () => {
  // A constant-rate infusion is the highest-consequence calculation here: the
  // output is milligrams of drug added to a bag that then runs into a patient
  // unattended for hours.
  const criInput = fc.record({
    doseMcgPerKgMin: positive(0.1, 50),
    weightKg,
    bagVolumeMl: positive(50, 1000),
    fluidRateMlPerHr: positive(1, 500),
  });

  it('produces finite quantities for every valid infusion', () => {
    fc.assert(
      fc.property(criInput, (input) => {
        const result = calculateCri(input);
        expect(isFiniteNumber(result.drugPerHourMcg)).toBe(true);
        expect(isFiniteNumber(result.bagDurationHr)).toBe(true);
        expect(isFiniteNumber(result.drugToAddMg)).toBe(true);
        expect(result.drugToAddMg).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it('never asks for less drug when the dose rate goes up', () => {
    fc.assert(
      fc.property(criInput, positive(1, 10), (input, multiplier) => {
        const base = calculateCri(input);
        const higher = calculateCri({
          ...input,
          doseMcgPerKgMin: input.doseMcgPerKgMin * multiplier,
        });
        expect(higher.drugPerHourMcg).toBeGreaterThanOrEqual(base.drugPerHourMcg);
        expect(higher.drugToAddMg).toBeGreaterThanOrEqual(base.drugToAddMg);
      })
    );
  });

  it('never asks for less drug for a heavier patient', () => {
    fc.assert(
      fc.property(criInput, positive(1, 10), (input, multiplier) => {
        const base = calculateCri(input);
        const heavier = calculateCri({ ...input, weightKg: input.weightKg * multiplier });
        expect(heavier.drugPerHourMcg).toBeGreaterThanOrEqual(base.drugPerHourMcg);
      })
    );
  });

  it('never makes a bag last longer by running it faster', () => {
    fc.assert(
      fc.property(criInput, positive(1, 10), (input, multiplier) => {
        const base = calculateCri(input);
        const faster = calculateCri({
          ...input,
          fluidRateMlPerHr: input.fluidRateMlPerHr * multiplier,
        });
        expect(faster.bagDurationHr).toBeLessThanOrEqual(base.bagDurationHr);
      })
    );
  });

  it('reports a drug volume only when a concentration is supplied', () => {
    fc.assert(
      fc.property(criInput, fc.option(positive(0.1, 500), { nil: undefined }), (input, conc) => {
        const result = calculateCri({ ...input, drugConcentrationMgPerMl: conc });
        if (conc === undefined) {
          expect(result.drugVolumeToAddMl).toBeNull();
        } else {
          expect(isFiniteNumber(result.drugVolumeToAddMl as number)).toBe(true);
        }
      })
    );
  });

  it.each(invalidInputs)('refuses a dose rate of %p with a typed error', (dose) => {
    expect(() =>
      calculateCri({
        doseMcgPerKgMin: dose,
        weightKg: 10,
        bagVolumeMl: 500,
        fluidRateMlPerHr: 50,
      })
    ).toThrow(CalculatorInputError);
  });

  it.each(invalidInputs)('refuses a fluid rate of %p rather than dividing by it', (rate) => {
    // Without the guard this is a division by zero, and a bag duration of
    // Infinity propagates into the milligrams of drug to add.
    expect(() =>
      calculateCri({
        doseMcgPerKgMin: 5,
        weightKg: 10,
        bagVolumeMl: 500,
        fluidRateMlPerHr: rate,
      })
    ).toThrow(CalculatorInputError);
  });
});

describe('calculateConcentration', () => {
  it('converts percent to mg/mL and scales volume with dose', () => {
    fc.assert(
      fc.property(positive(0.1, 100), positive(0.1, 5000), (percent, doseMg) => {
        const result = calculateConcentration({ percentSolution: percent, doseMg });
        expect(isFiniteNumber(result.concentrationMgPerMl)).toBe(true);
        expect(isFiniteNumber(result.volumeMl as number)).toBe(true);
        expect(result.volumeMl as number).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it('never requires more volume from a stronger solution', () => {
    fc.assert(
      fc.property(positive(0.1, 100), positive(1, 20), positive(1, 5000), (percent, mult, dose) => {
        const weaker = calculateConcentration({ percentSolution: percent, doseMg: dose });
        const stronger = calculateConcentration({
          percentSolution: percent * mult,
          doseMg: dose,
        });
        expect(stronger.volumeMl as number).toBeLessThanOrEqual(weaker.volumeMl as number);
      })
    );
  });

  it.each(invalidInputs)('refuses a solution strength of %p', (percent) => {
    expect(() => calculateConcentration({ percentSolution: percent })).toThrow(
      CalculatorInputError
    );
  });
});

describe('calculateDripRate', () => {
  it('produces finite figures for every valid rate', () => {
    fc.assert(
      fc.property(
        positive(1, 1000),
        fc.option(positive(10, 60), { nil: undefined }),
        (rate, gtt) => {
          const result = calculateDripRate({ rateMlPerHr: rate, dropFactorGttPerMl: gtt });
          expect(isFiniteNumber(result.dropsPerMin)).toBe(true);
          expect(isFiniteNumber(result.secondsPerDrop)).toBe(true);
        }
      )
    );
  });

  it('never counts fewer drops per minute at a faster rate', () => {
    fc.assert(
      fc.property(positive(1, 1000), positive(1, 10), (rate, multiplier) => {
        const base = calculateDripRate({ rateMlPerHr: rate });
        const faster = calculateDripRate({ rateMlPerHr: rate * multiplier });
        expect(faster.dropsPerMin).toBeGreaterThanOrEqual(base.dropsPerMin);
      })
    );
  });

  it('displays 0 drops per minute below roughly 1.5 mL/hr on a standard set', () => {
    // Pinning existing behaviour rather than asserting it is desirable. With the
    // default 20 gtt/mL set, 1 mL/hr is a third of a drop per minute and rounds
    // to zero, so the field reads "0" while fluid is genuinely running. It is
    // defensible - drops are not countable at that rate, and such patients are
    // on a syringe pump - but it is behaviour worth being deliberate about, and
    // secondsPerDrop stays finite because it is derived before the rounding.
    const result = calculateDripRate({ rateMlPerHr: 1 });
    expect(result.dropsPerMin).toBe(0);
    expect(Number.isFinite(result.secondsPerDrop)).toBe(true);
    expect(result.secondsPerDrop).toBeGreaterThan(0);
  });

  it.each(invalidInputs)('refuses a fluid rate of %p', (rate) => {
    expect(() => calculateDripRate({ rateMlPerHr: rate })).toThrow(CalculatorInputError);
  });
});
