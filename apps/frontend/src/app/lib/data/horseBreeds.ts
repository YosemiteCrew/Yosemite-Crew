import rawHorseBreeds from "./horseBreeds.json";

export type Breed = {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
};

const horseBreeds = rawHorseBreeds as Breed[];

export default horseBreeds;
