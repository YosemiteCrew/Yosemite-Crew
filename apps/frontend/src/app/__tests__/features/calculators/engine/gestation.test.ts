import { calculateGestation } from '@/app/features/calculators/engine/gestation';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateGestation', () => {
  it('computes the due date window for a dog (63 days)', () => {
    const result = calculateGestation({ species: 'dog', breedingDate: '2026-01-01' });
    expect(result.dueDate).toBe('2026-03-05');
    expect(result.earliest).toBe('2026-03-03');
    expect(result.latest).toBe('2026-03-07');
  });

  it('computes the due date window for a cat (65 days)', () => {
    const result = calculateGestation({ species: 'cat', breedingDate: '2026-01-01' });
    expect(result.dueDate).toBe('2026-03-07');
  });

  it('throws for an invalid breeding date', () => {
    expect(() => calculateGestation({ species: 'dog', breedingDate: 'not-a-date' })).toThrow(
      CalculatorInputError
    );
  });
});
