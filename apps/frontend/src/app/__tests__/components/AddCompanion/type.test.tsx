import {
  GenderOptions,
  NeuteredOptions,
  InsuredOptions,
  OriginOptions,
  SpeciesOptions,
  CountryDialCodeOptions,
  EMPTY_STORED_PARENT,
  createEmptyStoredCompanion,
} from '@/app/features/companions/components/AddCompanion/type';

// A country with no dial code cannot label a phone field, so it must not reach
// the dial-code dropdown. The bundled list has a dial code for every country,
// so the skip is only observable against a stubbed list.
jest.mock('@/app/lib/data/countryList', () => ({
  __esModule: true,
  default: [
    { name: 'United States', code: 'US', dial_code: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
    { name: 'Nowhere', code: 'NW', dial_code: '' },
  ],
}));

describe('AddCompanion type constants', () => {
  it('defines expected option sets', () => {
    expect(GenderOptions).toEqual(
      expect.arrayContaining([
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Unknown', value: 'unknown' },
      ])
    );

    expect(NeuteredOptions).toEqual(
      expect.arrayContaining([
        { label: 'Neutered', value: 'true' },
        { label: 'Not neutered', value: 'false' },
      ])
    );

    expect(InsuredOptions).toEqual(
      expect.arrayContaining([
        { label: 'Insured', value: 'true' },
        { label: 'Not insured', value: 'false' },
      ])
    );

    expect(OriginOptions).toEqual(
      expect.arrayContaining([
        { label: 'Shop', value: 'shop' },
        { label: 'Unknown', value: 'unknown' },
      ])
    );

    expect(SpeciesOptions).toEqual(
      expect.arrayContaining([
        { label: 'Canine', value: 'dog' },
        { label: 'Feline', value: 'cat' },
        { label: 'Equine', value: 'horse' },
      ])
    );
  });

  it('builds one dial-code option per country that has a dial code', () => {
    expect(CountryDialCodeOptions).toEqual([
      {
        value: 'US-+1',
        label: '+1 United States \u{1F1FA}\u{1F1F8}',
        dialCode: '+1',
        countryCode: 'US',
        countryName: 'United States',
        flag: '\u{1F1FA}\u{1F1F8}',
      },
    ]);
  });

  it('provides empty stored entities with expected defaults', () => {
    expect(EMPTY_STORED_PARENT).toEqual(
      expect.objectContaining({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        address: expect.objectContaining({
          addressLine: '',
          country: '',
          city: '',
          state: '',
          postalCode: '',
        }),
        createdFrom: 'pms',
      })
    );

    expect(createEmptyStoredCompanion()).toEqual(
      expect.objectContaining({
        name: '',
        type: 'dog',
        gender: 'unknown',
        source: 'unknown',
      })
    );
  });
});

/* The literal this replaced ran `new Date()` once at import, so every blank form
   for the life of the tab pre-filled the day the bundle loaded rather than
   today. A test that only checked the shape could not see that. */
describe('createEmptyStoredCompanion', () => {
  it('dates each blank form when it is created, not when the module loaded', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const first = createEmptyStoredCompanion();

      jest.setSystemTime(new Date('2026-06-15T00:00:00Z'));
      const second = createEmptyStoredCompanion();

      expect(first.dateOfBirth.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(second.dateOfBirth.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  it('hands every caller its own object', () => {
    // A shared const let one form's edits leak into the next blank form.
    const a = createEmptyStoredCompanion();
    const b = createEmptyStoredCompanion();
    a.name = 'Rex';
    a.alerts?.push({ id: 'x', type: 'medical', message: 'test' } as never);

    expect(b.name).toBe('');
    expect(b.alerts).toEqual([]);
  });
});
