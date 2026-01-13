import dogbreeds from "@/app/utils/dogBreeds.json";
import catbreeds from "@/app/utils/catBreeds.json";
import horsebreeds from "@/app/utils/horseBreeds.json";
import { StoredCompanion, StoredParent } from "@/app/pages/Companions/types";
import countries from "@/app/utils/countryList.json";

type OptionProp = {
  name: string;
  key: string;
};

export const GenderOptions: OptionProp[] = [
  { name: "Male", key: "male" },
  { name: "Female", key: "female" },
  { name: "Unknown", key: "unknown" },
];

export const NeuteredOptions: OptionProp[] = [
  { name: "Neutered", key: "true" },
  { name: "Not neutered", key: "false" },
];

export const InsuredOptions: OptionProp[] = [
  { name: "Insured", key: "true" },
  { name: "Not insured", key: "false" },
];

export const OriginOptions: OptionProp[] = [
  { name: "Shop", key: "shop" },
  { name: "Breeder", key: "breeder" },
  { name: "Foster/ Shelter", key: "foster_shelter" },
  { name: "Friends or family", key: "friends_family" },
  { name: "Unknown", key: "unknown" },
];

export type SpeciesOption = {
  value: string;
  label: string;
};
export type Option = {
  key: string;
  label: string;
};
export const SpeciesOptions: SpeciesOption[] = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "horse", label: "Horse" },
];
export const SpeciesOptions2: Option[] = [
  { key: "dog", label: "Dog" },
  { key: "cat", label: "Cat" },
  { key: "horse", label: "Horse" },
];
export type Breed = {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
};
export const BreedMap: Record<string, Option[]> = {
  dog: dogbreeds.map((breed) => ({
    key: breed.breedId + "",
    label: breed.breedName,
  })),
  cat: catbreeds.map((breed) => ({
    key: breed.breedId + "",
    label: breed.breedName,
  })),
  horse: horsebreeds.map((breed) => ({
    key: breed.breedId + "",
    label: breed.breedName,
  })),
};

export const CountriesOptions: Option[] = countries.map((country) => ({
  key: country.name,
  label: country.name,
}));

export const EMPTY_STORED_PARENT: StoredParent = {
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  birthDate: undefined,
  phoneNumber: "",
  address: {
    addressLine: "",
    country: "",
    city: "",
    state: "",
    postalCode: "",
    latitude: undefined,
    longitude: undefined,
  },
  createdFrom: "pms",
};

export const EMPTY_STORED_COMPANION: StoredCompanion = {
  id: "",
  organisationId: "",
  parentId: "",
  name: "",
  type: "dog",
  breed: "",
  dateOfBirth: new Date(),
  gender: "unknown",
  currentWeight: undefined,
  colour: "",
  allergy: "",
  bloodGroup: "",
  isneutered: false,
  microchipNumber: "",
  passportNumber: "",
  isInsured: false,
  insurance: undefined,
  countryOfOrigin: "",
  source: "unknown",
};
