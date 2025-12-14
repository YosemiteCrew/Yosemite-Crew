import { Specie, Breed } from "@/app/types/companion";

describe("Companion Type Definitions", () => {
  it("should validate valid Specie literal values", () => {
    // Verify that the literal types can be assigned correctly
    const dog: Specie = "Dog";
    const cat: Specie = "Cat";
    const horse: Specie = "Horse";

    expect(dog).toBe("Dog");
    expect(cat).toBe("Cat");
    expect(horse).toBe("Horse");
  });

  it("should validate the structure of a Breed object", () => {
    // Create an object that adheres to the Breed type
    const breed: Breed = {
      speciesId: 1,
      speciesName: "Dog",
      breedId: 101,
      breedName: "Golden Retriever",
    };

    // Assertions to verify the object properties exist and are correct types
    expect(breed).toBeDefined();
    expect(typeof breed.speciesId).toBe("number");
    expect(breed.speciesId).toBe(1);

    expect(typeof breed.speciesName).toBe("string");
    expect(breed.speciesName).toBe("Dog");

    expect(typeof breed.breedId).toBe("number");
    expect(breed.breedId).toBe(101);

    expect(typeof breed.breedName).toBe("string");
    expect(breed.breedName).toBe("Golden Retriever");
  });
});