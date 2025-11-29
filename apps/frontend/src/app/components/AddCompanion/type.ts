import dogbreeds from "@/app/utils/dogBreeds.json";
import catbreeds from "@/app/utils/catBreeds.json";
import horsebreeds from "@/app/utils/horseBreeds.json";

export const GenderOptions = ["Male", "Female", "Unknown"];
export const NeuteuredOptions = ["Neutered", "Not neutered"];
export const OriginOptions = [
  "Shop",
  "Breeder",
  "Foster/ Shelter",
  "Friends or family",
  "Unknown",
];
export type Specie = "Dog" | "Cat" | "Horse"
export const SpeciesOptions: Specie[] = ["Dog", "Cat", "Horse"];
export type Breed = {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
};
export const BreedMap: Record<string, Breed[]> = {
  Dog: dogbreeds,
  Cat: catbreeds,
  Horse: horsebreeds,
};
