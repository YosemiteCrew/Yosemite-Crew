import { duplicatePairId } from '@/app/features/companions/pages/PossibleDuplicates/useDuplicateReview';

const patient = (id: string) => ({ id, name: 'Poppy', dateOfBirth: '2020-01-02T00:00:00.000Z' });

describe('duplicatePairId', () => {
  it('gives a pair the same key whichever record is listed first', () => {
    const forward = duplicatePairId({
      patientA: patient('patient-b'),
      patientB: patient('patient-a'),
      matchingOn: 'microchip',
    });
    const reverse = duplicatePairId({
      patientA: patient('patient-a'),
      patientB: patient('patient-b'),
      matchingOn: 'name-and-birth-date',
    });

    expect(forward).toBe('patient-a:patient-b');
    expect(reverse).toBe(forward);
  });
});
