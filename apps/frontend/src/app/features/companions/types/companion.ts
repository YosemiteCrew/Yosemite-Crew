export type Specie = "Dog" | "Cat" | "Horse";

export type Option = {
  value: string;
  label: string;
};

export type Breed = {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
};

export type Gender = "Male" | "Female" | "Others";

export const GenderOptions: Option[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHERS", label: "Others" },
];

export const GenderOptionsSmall: Option[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "others", label: "Others" },
];

export const PetSourceOptions: Option[] = [
  { value: "breeder", label: "Breeder" },
  { value: "foster/shelter", label: "Foster/Shelter" },
  { value: "shop", label: "Shop" },
  { value: "friends/family", label: "Friends/Family" },
  { value: "other", label: "Other" },
];
