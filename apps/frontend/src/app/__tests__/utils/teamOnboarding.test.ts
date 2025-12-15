import { computeTeamOnboardingStep } from "../../utils/teamOnboarding";
import { UserProfile } from "../../types/profile";
import { ApiDayAvailability } from "../../components/Availability/utils";

// --- Mock Data Helpers ---

const createValidProfile = (overrides?: DeepPartial<UserProfile>): UserProfile => {
  const baseProfile: any = {
    personalDetails: {
      dateOfBirth: "1990-01-01",
      gender: "Male",
      phoneNumber: "1234567890",
      address: {
        addressLine: "123 Main St",
        city: "Tech City",
        state: "CA",
        postalCode: "90210",
        country: "USA",
      },
    },
    professionalDetails: {
      qualification: "DVM",
      yearsOfExperience: 5,
      specialization: "Surgery",
    },
  };

  // simplistic deep merge for mocking purposes
  if (overrides) {
    if (overrides.personalDetails) {
      Object.assign(baseProfile.personalDetails, overrides.personalDetails);
    }
    if (overrides.professionalDetails) {
      Object.assign(baseProfile.professionalDetails, overrides.professionalDetails);
    }
  }
  return baseProfile;
};

// Type helper for the mock function
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const mockSlots: ApiDayAvailability[] = [
  { day: "Monday", slots: [{ start: "09:00", end: "17:00" }] } as any,
];

describe("computeTeamOnboardingStep", () => {

  // --- Section 1: Step 0 (Input Validation) ---

  it("returns 0 if profile is null", () => {
    expect(computeTeamOnboardingStep(null, mockSlots)).toBe(0);
  });

  it("returns 0 if profile is undefined", () => {
    expect(computeTeamOnboardingStep(undefined, mockSlots)).toBe(0);
  });

  // --- Section 2: Step 0 (Personal Details Validation) ---

  it("returns 0 if 'personalDetails' object is missing entirely", () => {
    const profile = createValidProfile();
    delete (profile as any).personalDetails;
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
  });

  it("returns 0 if 'dateOfBirth' is missing", () => {
    const profile = createValidProfile({ personalDetails: { dateOfBirth: "" } });
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
  });

  it("returns 0 if 'gender' is missing", () => {
    const profile = createValidProfile({ personalDetails: { gender: "" } });
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
  });

  it("returns 0 if 'phoneNumber' is missing", () => {
    const profile = createValidProfile({ personalDetails: { phoneNumber: "" } });
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
  });

  describe("Address Validation (Step 0)", () => {
    it("returns 0 if 'address' object is missing", () => {
        // Create valid profile then delete address
        const profile = createValidProfile();
        (profile.personalDetails as any).address = undefined;
        expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
    });

    it("returns 0 if 'addressLine' is missing", () => {
      const profile = createValidProfile({ personalDetails: { address: { addressLine: "" } } });
      expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
    });

    it("returns 0 if 'city' is missing", () => {
      const profile = createValidProfile({ personalDetails: { address: { city: "" } } });
      expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
    });

    it("returns 0 if 'state' is missing", () => {
      const profile = createValidProfile({ personalDetails: { address: { state: "" } } });
      expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
    });

    it("returns 0 if 'postalCode' is missing", () => {
      const profile = createValidProfile({ personalDetails: { address: { postalCode: "" } } });
      expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
    });

    it("returns 0 if 'country' is missing", () => {
      const profile = createValidProfile({ personalDetails: { address: { country: "" } } });
      expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(0);
    });
  });

  // --- Section 3: Step 1 (Professional Details Validation) ---
  // Reaching here implies Step 0 is complete.

  it("returns 1 if 'professionalDetails' object is missing entirely", () => {
    const profile = createValidProfile();
    delete (profile as any).professionalDetails;
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(1);
  });

  it("returns 1 if 'qualification' is missing", () => {
    const profile = createValidProfile({ professionalDetails: { qualification: "" } });
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(1);
  });

  it("returns 1 if 'yearsOfExperience' is missing (or zero/falsy)", () => {
    // Assuming 0 experience might be treated as falsy in your logic (!!0 is false).
    // If 0 is valid, the source code should check "!= null".
    // Based on current source "!!yearsOfExperience", 0 fails.
    const profile = createValidProfile({ professionalDetails: { yearsOfExperience: 0 } });
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(1);
  });

  it("returns 1 if 'specialization' is missing", () => {
    const profile = createValidProfile({ professionalDetails: { specialization: "" } });
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(1);
  });

  // --- Section 4: Step 2 & 3 (Availability & Completion) ---
  // Reaching here implies Step 0 and Step 1 are complete.

  it("returns 2 if profile is complete but slots are empty", () => {
    const profile = createValidProfile();
    const emptySlots: ApiDayAvailability[] = [];
    expect(computeTeamOnboardingStep(profile, emptySlots)).toBe(2);
  });

  it("returns 3 if profile is complete and slots are provided", () => {
    const profile = createValidProfile();
    expect(computeTeamOnboardingStep(profile, mockSlots)).toBe(3);
  });
});