import {
  GenderOptions,
  NeuteredOptions,
  InsuredOptions,
  OriginOptions,
  SpeciesOptions,
  CountryDialCodeOptions,
  EMPTY_STORED_PARENT,
  EMPTY_STORED_COMPANION,
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

    expect(EMPTY_STORED_COMPANION).toEqual(
      expect.objectContaining({
        name: '',
        type: 'dog',
        gender: 'unknown',
        source: 'unknown',
      })
    );
  });
});
