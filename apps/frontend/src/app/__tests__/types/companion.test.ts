import { Specie, Breed } from "../../types/companion";

describe("Companion Types Definition", () => {

  // --- Section 1: Specie Union Type ---
  describe("Specie Union Type", () => {
    it("accepts valid Specie literal values", () => {
      const dog: Specie = "Dog";
      const cat: Specie = "Cat";
      const horse: Specie = "Horse";

      expect(dog).toBe("Dog");
      expect(cat).toBe("Cat");
      expect(horse).toBe("Horse");
    });
  });

  // --- Section 2: Breed Object Structure (Numeric Fields) ---
  describe("Breed Structure (Ids)", () => {
    it("requires numeric values for speciesId and breedId", () => {
      const goldenRetriever: Breed = {
        speciesId: 1,
        speciesName: "Dog",
        breedId: 101,
        breedName: "Golden Retriever",
      };

      expect(typeof goldenRetriever.speciesId).toBe("number");
      expect(typeof goldenRetriever.breedId).toBe("number");
      expect(goldenRetriever.speciesId).toBe(1);
    });
  });

  // --- Section 3: Breed Object Structure (String Fields) ---
  describe("Breed Structure (Names)", () => {
    it("requires string values for speciesName and breedName", () => {
      const persian: Breed = {
        speciesId: 2,
        speciesName: "Cat",
        breedId: 202,
        breedName: "Persian",
      };

      expect(typeof persian.speciesName).toBe("string");
      expect(typeof persian.breedName).toBe("string");
      expect(persian.breedName).toBe("Persian");
    });
  });

  // --- Section 4: Type Integrity ---
  describe("Type Integrity", () => {
    it("creates a valid Breed object with all required fields", () => {
      // This ensures strict typing enforces all 4 fields are present
      const arabianHorse: Breed = {
        speciesId: 3,
        speciesName: "Horse",
        breedId: 305,
        breedName: "Arabian",
      };

      const keys = Object.keys(arabianHorse);
      expect(keys).toContain("speciesId");
      expect(keys).toContain("speciesName");
      expect(keys).toContain("breedId");
      expect(keys).toContain("breedName");
    });
  });
});