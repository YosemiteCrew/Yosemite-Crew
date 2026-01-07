import { renderHook } from "@testing-library/react";
import { useOrgOnboarding } from "../../hooks/useOrgOnboarding";
import { useOrgStore } from "../../stores/orgStore";
import { useSpecialityStore } from "../../stores/specialityStore";
import { computeOrgOnboardingStep } from "../../utils/orgOnboarding";

// --- Mocks ---

jest.mock("../../stores/orgStore");
jest.mock("../../stores/specialityStore");
jest.mock("../../utils/orgOnboarding", () => ({
  computeOrgOnboardingStep: jest.fn(),
}));

describe("useOrgOnboarding Hook", () => {
  let mockOrgState: any;
  let mockSpecialityState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock State
    mockOrgState = {
      status: "success",
      orgsById: {
        "org-1": { _id: "org-1", name: "Test Org" },
      },
      membershipsByOrgId: {
        "org-1": { roleCode: "OWNER" },
      },
    };

    mockSpecialityState = {
      specialitiesById: {
        "spec-1": { _id: "spec-1", name: "Surgery" },
        "spec-2": { _id: "spec-2", name: "Dental" },
      },
      specialityIdsByOrgId: {
        "org-1": ["spec-1", "spec-2"],
      },
    };

    // Setup Store Mocks
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useSpecialityStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockSpecialityState)
    );

    // Default utility return
    (computeOrgOnboardingStep as jest.Mock).mockReturnValue(2);
  });

  // --- Section 1: Initial & Empty States ---

  it("should return empty/step 0 if orgId is null", () => {
    const { result } = renderHook(() => useOrgOnboarding(null));

    expect(result.current.org).toBeNull();
    expect(result.current.step).toBe(0);
    expect(result.current.specialities).toEqual([]);
  });

  it("should return empty/step 0 if org store status is 'loading'", () => {
    mockOrgState.status = "loading";

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.step).toBe(0);
    expect(result.current.org).toBeNull();
  });

  it("should return empty/step 0 if org store status is 'idle'", () => {
    mockOrgState.status = "idle";

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.step).toBe(0);
  });

  it("should return empty/step 0 if org does not exist in store", () => {
    mockOrgState.orgsById = {}; // Empty orgs

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.step).toBe(0);
    expect(result.current.org).toBeNull();
  });

  it("should return empty/step 0 if membership does not exist", () => {
    mockOrgState.membershipsByOrgId = {}; // Empty memberships

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.step).toBe(0);
  });

  // --- Section 2: Access Control (Owner vs Non-Owner) ---

  it("should return valid data if user is OWNER (roleCode)", () => {
    // mockOrgState defaults to OWNER
    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.org).toEqual(mockOrgState.orgsById["org-1"]);
    expect(result.current.specialities).toHaveLength(2);
    // Utility called?
    expect(computeOrgOnboardingStep).toHaveBeenCalledWith(
      mockOrgState.orgsById["org-1"],
      expect.arrayContaining([
        expect.objectContaining({ _id: "spec-1" }),
        expect.objectContaining({ _id: "spec-2" }),
      ])
    );
    expect(result.current.step).toBe(2); // From mock
  });

  it("should return valid data if user is OWNER (roleDisplay fallback)", () => {
    mockOrgState.membershipsByOrgId["org-1"] = { roleCode: null, roleDisplay: "Owner" };

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.org).not.toBeNull();
    expect(result.current.step).toBe(2);
  });

  it("should return empty state if user is NOT Owner (e.g. 'Member')", () => {
    mockOrgState.membershipsByOrgId["org-1"] = { roleCode: "MEMBER" };

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.step).toBe(0);
    expect(result.current.org).toBeNull();
    expect(result.current.specialities).toEqual([]);
    expect(computeOrgOnboardingStep).not.toHaveBeenCalled();
  });

  it("should handle missing role fields gracefully (treat as non-owner)", () => {
    mockOrgState.membershipsByOrgId["org-1"] = { roleCode: null, roleDisplay: null };

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.step).toBe(0);
  });

  // --- Section 3: Speciality Data Mapping ---

  it("should filter out undefined specialities (broken IDs)", () => {
    mockSpecialityState.specialityIdsByOrgId["org-1"] = ["spec-1", "spec-missing"];

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.specialities).toHaveLength(1);
    expect(result.current.specialities[0]._id).toBe("spec-1");
  });

  it("should default to empty array if no speciality IDs found for org", () => {
    mockSpecialityState.specialityIdsByOrgId = {}; // No entry for org-1

    const { result } = renderHook(() => useOrgOnboarding("org-1"));

    expect(result.current.specialities).toEqual([]);
    expect(computeOrgOnboardingStep).toHaveBeenCalledWith(
      expect.anything(),
      [] // Empty array passed to calculator
    );
  });
});