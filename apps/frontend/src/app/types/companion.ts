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

export const PetSourceOptions: Option[] = [
  { value: "Breeder", label: "Breeder" },
  { value: "Foster/Shelter", label: "Foster/Shelter" },
  { value: "Shop", label: "Shop" },
  { value: "Friends/Family", label: "Friends/Family" },
  { value: "Other", label: "Other" },
];
