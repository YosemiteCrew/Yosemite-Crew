import { StoredCompanion, StoredParent } from '@/app/features/companions/pages/Companions/types';
import countries from '@/app/lib/data/countryList';

export type Option = {
  value: string;
  label: string;
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
