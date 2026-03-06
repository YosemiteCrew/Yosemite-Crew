import rawCatBreeds from "./catBreeds.json";

export type Breed = {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
};

const catBreeds = rawCatBreeds as Breed[];

export default catBreeds;
