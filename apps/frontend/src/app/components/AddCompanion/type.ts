import dogbreeds from "@/app/utils/dogBreeds.json";
import catbreeds from "@/app/utils/catBreeds.json";
import horsebreeds from "@/app/utils/horseBreeds.json";
import { StoredCompanion, StoredParent } from "@/app/pages/Companions/types";
import countries from "@/app/utils/countryList.json";

export type Option = {
  value: string;
  label: string;
};

export const GenderOptions: Option[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Unknown", value: "unknown" },
];

export const NeuteredOptions: Option[] = [
  { label: "Neutered", value: "true" },
  { label: "Not neutered", value: "false" },
];

export const InsuredOptions: Option[] = [
  { label: "Insured", value: "true" },
  { label: "Not insured", value: "false" },
];

export const OriginOptions: Option[] = [
  { label: "Shop", value: "shop" },
  { label: "Breeder", value: "breeder" },
  { label: "Foster/ Shelter", value: "foster_shelter" },
  { label: "Friends or family", value: "friends_family" },
  { label: "Unknown", value: "unknown" },
];
export const SpeciesOptions: Option[] = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "horse", label: "Horse" },
];
export type Breed = {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
};
export const BreedMap: Record<string, Option[]> = {
  dog: dogbreeds.map((breed) => ({
    value: breed.breedId + "",
    label: breed.breedName,
  })),
  cat: catbreeds.map((breed) => ({
    value: breed.breedId + "",
    label: breed.breedName,
  })),
  horse: horsebreeds.map((breed) => ({
    value: breed.breedId + "",
    label: breed.breedName,
  })),
};

export const CountriesOptions: Option[] = countries.map((country) => ({
  value: country.name,
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
