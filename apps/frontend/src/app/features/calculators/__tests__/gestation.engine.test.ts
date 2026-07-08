import { calculateGestation } from '@/app/features/calculators/engine/gestation';

describe('calculateGestation', () => {
  it('computes due date window for a dog (63-day gestation)', () => {
    const r = calculateGestation({ species: 'dog', breedingDate: '2026-01-01' });
    expect(r.dueDate).toBe('2026-03-05');
    expect(r.earliest).toBe('2026-03-03');
    expect(r.latest).toBe('2026-03-07');
  });

  it('computes due date for a cat (65-day gestation)', () => {
    const r = calculateGestation({ species: 'cat', breedingDate: '2026-01-01' });
    expect(r.dueDate).toBe('2026-03-07');
    expect(r.earliest).toBe('2026-03-05');
    expect(r.latest).toBe('2026-03-09');
  });

  it('rejects an empty breeding date', () => {
    expect(() => calculateGestation({ species: 'dog', breedingDate: '' })).toThrow(
      'Breeding date is required.'
    );
  });

  it('rejects an invalid breeding date', () => {
    expect(() => calculateGestation({ species: 'cat', breedingDate: 'not-a-date' })).toThrow(
      'Breeding date is required.'
    );
  });
});
