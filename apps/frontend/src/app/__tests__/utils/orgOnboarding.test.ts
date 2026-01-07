import { computeOrgOnboardingStep } from "../../utils/orgOnboarding";
import type { Organisation, Speciality } from "@yosemite-crew/types";

// Mock Data Helper to create a valid org quickly
const createMockOrg = (overrides?: Partial<Organisation>): Organisation => ({
  _id: "org-123",
  name: "Yosemite Crew",
  taxId: "TAX-001",
  phoneNo: "123-456-7890",
  address: {
    country: "USA",
    addressLine: "123 El Capitan Way",
    city: "Yosemite Valley",
    state: "CA",
    postalCode: "95389",
  },
  ...overrides,
} as Organisation);

const mockSpecialities: Speciality[] = [
  { _id: "spec-1", name: "Climbing", organisationId: "org-123" },
];

describe("computeOrgOnboardingStep", () => {
  // --- Section 1: Step 0 Checks (Basic Info) ---

  it("returns 0 if organisation is null", () => {
    expect(computeOrgOnboardingStep(null, [])).toBe(0);
  });

  it("returns 0 if organisation is undefined", () => {
    expect(computeOrgOnboardingStep(undefined, [])).toBe(0);
  });

  it("returns 0 if 'name' is missing", () => {
    const org = createMockOrg({ name: "" });
    expect(computeOrgOnboardingStep(org, [])).toBe(0);
  });

  it("returns 0 if 'taxId' is missing", () => {
    const org = createMockOrg({ taxId: "" });
    expect(computeOrgOnboardingStep(org, [])).toBe(0);
  });

  it("returns 0 if 'phoneNo' is missing", () => {
    const org = createMockOrg({ phoneNo: "" });
    expect(computeOrgOnboardingStep(org, [])).toBe(0);
  });

  it("returns 0 if 'address' object is missing entirely", () => {
    // Force address to undefined to test the optional chaining safety
    const org = createMockOrg({ address: undefined });
    expect(computeOrgOnboardingStep(org, [])).toBe(0);
  });

  it("returns 0 if 'country' is missing inside address", () => {
    const org = createMockOrg({ address: { ...createMockOrg().address!, country: "" } });
    expect(computeOrgOnboardingStep(org, [])).toBe(0);
  });

  // --- Section 2: Step 1 Checks (Detailed Address) ---
  // The function reaches this logic only if "hasStep1" (Basic Info) is true.

  it("returns 1 if basic info is present but 'addressLine' is missing", () => {
    const org = createMockOrg({ address: { ...createMockOrg().address!, addressLine: "" } });
    expect(computeOrgOnboardingStep(org, [])).toBe(1);
  });

  it("returns 1 if basic info is present but 'city' is missing", () => {
    const org = createMockOrg({ address: { ...createMockOrg().address!, city: "" } });
    expect(computeOrgOnboardingStep(org, [])).toBe(1);
  });

  it("returns 1 if basic info is present but 'postalCode' is missing", () => {
    const org = createMockOrg({ address: { ...createMockOrg().address!, postalCode: "" } });
    expect(computeOrgOnboardingStep(org, [])).toBe(1);
  });

  it("returns 1 if basic info is present but 'state' is missing", () => {
    const org = createMockOrg({ address: { ...createMockOrg().address!, state: "" } });
    expect(computeOrgOnboardingStep(org, [])).toBe(1);
  });

  // --- Section 3: Step 2 Checks (Specialities) ---
  // The function reaches this logic only if "hasStep2" (Address details) is true.

  it("returns 2 if all org details are valid but specialities list is empty", () => {
    const org = createMockOrg(); // Fully valid org
    const specialities: Speciality[] = [];
    expect(computeOrgOnboardingStep(org, specialities)).toBe(2);
  });

  // --- Section 4: Step 3 (Onboarding Complete) ---

  it("returns 3 if all org details are valid and specialities exist", () => {
    const org = createMockOrg();
    const specialities = mockSpecialities;
    expect(computeOrgOnboardingStep(org, specialities)).toBe(3);
  });
});