import { makeOptions, type LabelValueOption } from '@/app/lib/options';

describe('makeOptions', () => {
  it('builds { label, value } objects from [label, value] pairs in order', () => {
    expect(
      makeOptions([
        ['Health', 'HEALTH'],
        ['Hygiene maintenance', 'HYGIENE_MAINTENANCE'],
      ])
    ).toEqual([
      { label: 'Health', value: 'HEALTH' },
      { label: 'Hygiene maintenance', value: 'HYGIENE_MAINTENANCE' },
    ]);
  });

  it('returns an empty array for no pairs', () => {
    expect(makeOptions([])).toEqual([]);
  });

  it('keeps duplicate values as distinct entries', () => {
    const options = makeOptions([
      ['First other', 'OTHER'],
      ['Second other', 'OTHER'],
    ]);
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({ label: 'First other', value: 'OTHER' });
    expect(options[1]).toEqual({ label: 'Second other', value: 'OTHER' });
  });

  it('preserves narrowed value types', () => {
    type Species = 'DOG' | 'CAT';
    const options: LabelValueOption<Species>[] = makeOptions([
      ['Dog', 'DOG'],
      ['Cat', 'CAT'],
    ]);
    expect(options.map((option) => option.value)).toEqual(['DOG', 'CAT']);
  });

  it('returns a fresh array and fresh objects on each call', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [['Other', 'OTHER']];
    const first = makeOptions(pairs);
    const second = makeOptions(pairs);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first).toEqual(second);
  });
});
