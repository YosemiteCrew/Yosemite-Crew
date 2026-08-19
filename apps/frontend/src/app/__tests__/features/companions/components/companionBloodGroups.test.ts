import { BLOOD_GROUP_OPTIONS_BY_SPECIES } from '@/app/features/companions/components/companionBloodGroups';

describe('BLOOD_GROUP_OPTIONS_BY_SPECIES', () => {
  it('covers every companion type', () => {
    expect(Object.keys(BLOOD_GROUP_OPTIONS_BY_SPECIES).sort((a, b) => a.localeCompare(b))).toEqual([
      'cat',
      'dog',
      'horse',
      'other',
    ]);
  });

  it('lists feline, canine and equine blood groups with an Unknown fallback', () => {
    expect(BLOOD_GROUP_OPTIONS_BY_SPECIES.cat.map((option) => option.value)).toEqual([
      'A',
      'B',
      'AB',
      'Unknown',
    ]);
    expect(BLOOD_GROUP_OPTIONS_BY_SPECIES.dog).toHaveLength(14);
    expect(BLOOD_GROUP_OPTIONS_BY_SPECIES.dog.map((option) => option.value)).toEqual(
      expect.arrayContaining(['DEA 1.1 Positive', 'Universal Donor', 'Unknown'])
    );
    expect(BLOOD_GROUP_OPTIONS_BY_SPECIES.horse).toHaveLength(9);
    expect(BLOOD_GROUP_OPTIONS_BY_SPECIES.other).toEqual([{ value: 'Unknown', label: 'Unknown' }]);
  });

  it('uses the blood group as both value and label for every option', () => {
    for (const options of Object.values(BLOOD_GROUP_OPTIONS_BY_SPECIES)) {
      for (const option of options) {
        expect(option.label).toBe(option.value);
      }
    }
  });
});
