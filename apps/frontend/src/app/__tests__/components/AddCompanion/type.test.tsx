import {
  GenderOptions,
  NeuteredOptions,
  InsuredOptions,
  OriginOptions,
  SpeciesOptions,
  EMPTY_STORED_PARENT,
  EMPTY_STORED_COMPANION,
} from "@/app/components/AddCompanion/type";

describe("AddCompanion type constants", () => {
  it("defines expected option sets", () => {
    expect(GenderOptions).toEqual(
      expect.arrayContaining([
        { label: "Male", value: "male" },
        { label: "Female", value: "female" },
        { label: "Unknown", value: "unknown" },
      ])
    );

    expect(NeuteredOptions).toEqual(
      expect.arrayContaining([
        { label: "Neutered", value: "true" },
        { label: "Not neutered", value: "false" },
      ])
    );

    expect(InsuredOptions).toEqual(
      expect.arrayContaining([
        { label: "Insured", value: "true" },
        { label: "Not insured", value: "false" },
      ])
    );

    expect(OriginOptions).toEqual(
      expect.arrayContaining([
        { label: "Shop", value: "shop" },
        { label: "Unknown", value: "unknown" },
      ])
    );

    expect(SpeciesOptions).toEqual(
      expect.arrayContaining([
        { label: "Dog", value: "dog" },
        { label: "Cat", value: "cat" },
        { label: "Horse", value: "horse" },
      ])
    );
  });

  it("provides empty stored entities with expected defaults", () => {
    expect(EMPTY_STORED_PARENT).toEqual(
      expect.objectContaining({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        address: expect.objectContaining({
          addressLine: "",
          country: "",
          city: "",
          state: "",
          postalCode: "",
        }),
        createdFrom: "pms",
      })
    );

    expect(EMPTY_STORED_COMPANION).toEqual(
      expect.objectContaining({
        name: "",
        type: "dog",
        gender: "unknown",
        source: "unknown",
      })
    );
  });
});
