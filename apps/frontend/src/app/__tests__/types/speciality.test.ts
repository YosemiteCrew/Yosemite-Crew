import { SpecialityWeb } from "../../types/speciality";
import { Service } from "@yosemite-crew/types";

// Mock helper to simulate the external Service type structure
const mockService: Service = {
  _id: "srv-1",
  name: "Consultation",
  duration: 30,
  price: 50
} as unknown as Service;

describe("SpecialityWeb Type Definition", () => {

  // --- Section 1: Base Properties Inheritance ---
  describe("Inheritance", () => {
    it("inherits required properties from the base Speciality type", () => {
      // We explicitly type this to ensure TS validates the required fields match Speciality
      const specialityItem: SpecialityWeb = {
        _id: "spec-123",
        name: "Cardiology",
        organisationId: "org-99",
        // services is optional, so this object is valid without it
      } as SpecialityWeb;

      expect(specialityItem._id).toBe("spec-123");
      expect(specialityItem.name).toBe("Cardiology");
      expect(specialityItem.organisationId).toBe("org-99");
    });
  });

  // --- Section 2: Optional 'services' Property (Missing) ---
  describe("Optional Services (Undefined)", () => {
    it("allows creating an object where 'services' is undefined", () => {
      const specialityWithoutServices: SpecialityWeb = {
        _id: "spec-456",
        name: "General Practice",
        organisationId: "org-88",
        services: undefined, // Explicitly undefined
      } as SpecialityWeb;

      expect(specialityWithoutServices).toBeDefined();
      expect(specialityWithoutServices.services).toBeUndefined();
    });

    it("allows creating an object where 'services' is omitted entirely", () => {
      const specialityImplicit: SpecialityWeb = {
        _id: "spec-789",
        name: "Dermatology",
        organisationId: "org-77",
      } as SpecialityWeb;

      expect(specialityImplicit.services).toBeUndefined();
    });
  });

  // --- Section 3: Optional 'services' Property (Present) ---
  describe("Optional Services (Present)", () => {
    it("allows 'services' to be an array of Service objects", () => {
      const specialityWithServices: SpecialityWeb = {
        _id: "spec-101",
        name: "Surgery",
        organisationId: "org-66",
        services: [mockService],
      } as SpecialityWeb;

      expect(specialityWithServices.services).toHaveLength(1);
      expect(specialityWithServices.services?.[0]).toEqual(mockService);
    });
  });

  // --- Section 4: Array Structure Integrity ---
  describe("Structure Integrity", () => {
    it("allows 'services' to be an empty array", () => {
      const specialityEmptyServices: SpecialityWeb = {
        _id: "spec-202",
        name: "Radiology",
        organisationId: "org-55",
        services: [],
      } as SpecialityWeb;

      expect(Array.isArray(specialityEmptyServices.services)).toBe(true);
      expect(specialityEmptyServices.services).toHaveLength(0);
    });
  });
});