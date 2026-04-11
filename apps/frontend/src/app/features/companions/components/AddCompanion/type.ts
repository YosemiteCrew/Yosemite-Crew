import { StoredCompanion, StoredParent } from '@/app/features/companions/pages/Companions/types';
import countries from '@/app/lib/data/countryList';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type Option = {
  value: string;
  label: string;
};

export type CountryDialCodeOption = Option & {
  dialCode: string;
  countryCode: string;
  countryName: string;
  flag?: string;
};

export const GenderOptions: Option[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Unknown', value: 'unknown' },
];

export const getNeuteredOptions = (gender?: string): Option[] => {
  const term = gender === 'female' ? 'Spayed' : 'Neutered';
  return [
    { label: term, value: 'true' },
    { label: `Not ${term.toLowerCase()}`, value: 'false' },
  ];
};

export const NeuteredOptions: Option[] = getNeuteredOptions();

export const InsuredOptions: Option[] = [
  { label: 'Insured', value: 'true' },
  { label: 'Not insured', value: 'false' },
];

export const OriginOptions: Option[] = [
  { label: 'Shop', value: 'shop' },
  { label: 'Breeder', value: 'breeder' },
  { label: 'Foster/ Shelter', value: 'foster_shelter' },
  { label: 'Friends or family', value: 'friends_family' },
  { label: 'Stray', value: 'stray' },
  { label: 'Unknown', value: 'unknown' },
];
export const SpeciesOptions: Option[] = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'horse', label: 'Horse' },
];
export type Breed = {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
};

export const CountriesOptions: Option[] = countries.map((country) => ({
  value: country.name,
  label: country.name,
}));

export const DEFAULT_COUNTRY_DIAL_CODE = '+1';
export const DEFAULT_COUNTRY_CODE = 'US';

export const CountryDialCodeOptions: CountryDialCodeOption[] = countries
  .filter((country) => Boolean(country.dial_code))
  .map((country) => {
    const dialCode = country.dial_code ?? '';
    const countryCode = country.code ?? country.name;
    const flagPrefix = country.flag ? `${country.flag} ` : '';
    return {
      value: `${countryCode}-${dialCode}`,
      label: `${flagPrefix}${dialCode} ${country.name}`,
      dialCode,
      countryCode,
      countryName: country.name,
      flag: country.flag,
    };
  });

export const getDefaultCountryDialCodeOption = (): CountryDialCodeOption =>
  CountryDialCodeOptions.find((option) => option.countryCode === DEFAULT_COUNTRY_CODE) ??
  CountryDialCodeOptions.find((option) => option.dialCode === DEFAULT_COUNTRY_DIAL_CODE) ??
  CountryDialCodeOptions[0];

export const getDigitsOnly = (value: string) => value.replaceAll(/\D/g, '');

export const getCountryDialCodeOptionByCountryName = (countryName?: string) => {
  if (!countryName) {
    return null;
  }
  return (
    CountryDialCodeOptions.find(
      (option) => option.countryName.toLowerCase() === countryName.trim().toLowerCase()
    ) ?? null
  );
};

export const findPhoneData = (
  value: string,
  fallbackCountryName?: string
): { selectedCode: CountryDialCodeOption; localNumber: string } => {
  const defaultCode =
    getCountryDialCodeOptionByCountryName(fallbackCountryName) ?? getDefaultCountryDialCodeOption();

  const parsedPhoneNumber = parsePhoneNumberFromString(value);
  if (parsedPhoneNumber) {
    const dialCode = `+${parsedPhoneNumber.countryCallingCode}`;
    const selectedCode =
      CountryDialCodeOptions.find((option) => option.dialCode === dialCode) ?? defaultCode;
    return {
      selectedCode,
      localNumber: parsedPhoneNumber.nationalNumber,
    };
  }

  const normalized = value.trim();
  const digits = getDigitsOnly(normalized);
  if (!digits) {
    return {
      selectedCode: defaultCode,
      localNumber: '',
    };
  }

  if (!normalized.startsWith('+')) {
    return {
      selectedCode: defaultCode,
      localNumber: digits,
    };
  }

  const matchedOption = CountryDialCodeOptions.filter((option) =>
    digits.startsWith(getDigitsOnly(option.dialCode))
  ).sort((a, b) => b.dialCode.length - a.dialCode.length)[0];

  if (!matchedOption) {
    return {
      selectedCode: defaultCode,
      localNumber: digits,
    };
  }

  const dialCodeDigits = getDigitsOnly(matchedOption.dialCode);
  const localNumber = digits.startsWith(dialCodeDigits)
    ? digits.slice(dialCodeDigits.length)
    : digits;
  return {
    selectedCode: matchedOption,
    localNumber,
  };
};

export const EMPTY_STORED_PARENT: StoredParent = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  birthDate: undefined,
  phoneNumber: '',
  address: {
    addressLine: '',
    country: '',
    city: '',
    state: '',
    postalCode: '',
    latitude: undefined,
    longitude: undefined,
  },
  createdFrom: 'pms',
};

export const EMPTY_STORED_COMPANION: StoredCompanion = {
  id: '',
  organisationId: '',
  parentId: '',
  name: '',
  type: 'dog',
  speciesCode: '',
  breed: '',
  breedCode: '',
  dateOfBirth: new Date(),
  gender: 'unknown',
  currentWeight: undefined,
  colour: '',
  allergy: '',
  bloodGroup: '',
  isneutered: false,
  microchipNumber: '',
  passportNumber: '',
  isInsured: false,
  insurance: undefined,
  countryOfOrigin: '',
  source: 'unknown',
};
