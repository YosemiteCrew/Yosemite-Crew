import rawDogBreeds from "./dogBreeds.json";

export type Breed = {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
};

const dogBreeds = rawDogBreeds as Breed[];

export default dogBreeds;
