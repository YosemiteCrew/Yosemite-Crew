import { renderHook } from "@testing-library/react";
import { useTeamOnboarding } from "@/app/hooks/useTeamOnboarding";
import { useOrgStore } from "@/app/stores/orgStore";
import { useUserProfileStore } from "@/app/stores/profileStore";
import { useAvailabilityStore } from "@/app/stores/availabilityStore";
import { computeTeamOnboardingStep } from "@/app/utils/teamOnboarding";

// --- Mocks ---

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

jest.mock("@/app/stores/profileStore", () => ({
  useUserProfileStore: jest.fn(),
}));

jest.mock("@/app/stores/availabilityStore", () => ({
  useAvailabilityStore: jest.fn(),
}));

jest.mock("@/app/utils/teamOnboarding", () => ({
  computeTeamOnboardingStep: jest.fn(),
}));

describe("useTeamOnboarding Hook", () => {
  const mockOrgId = "org-123";
  const mockProfile = { id: "user-1", name: "John Doe" };
  const mockMembership = { roleCode: "staff" };
  const mockAvailabilities = [{ day: "Monday", slots: [] }];

  const setupMocks = (
    overrides: {
      orgStatus?: string;
      availabilityStatus?: string;
      profilesByOrgId?: Record<string, any>;
      membershipsByOrgId?: Record<string, any>;
      availabilitiesById?: Record<string, any>;
      availabilityIdsByOrgId?: Record<string, string[]>;
      computedStep?: number;
    } = {}
  ) => {
    // 1. Mock Org Store
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        status: overrides.orgStatus || "loaded",
        membershipsByOrgId: overrides.membershipsByOrgId || {
          [mockOrgId]: mockMembership,
        },
      };
      return selector(state);
    });

    // 2. Mock Profile Store
    (useUserProfileStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        profilesByOrgId: overrides.profilesByOrgId || {
          [mockOrgId]: mockProfile,
        },
      };
      return selector(state);
    });

    // 3. Mock Availability Store
    (useAvailabilityStore as unknown as jest.Mock).mockImplementation(
      (selector) => {
        const state = {
          status: overrides.availabilityStatus || "loaded",
          availabilitiesById: overrides.availabilitiesById || {
            "avail-1": mockAvailabilities[0],
          },
          availabilityIdsByOrgId: overrides.availabilityIdsByOrgId || {
            [mockOrgId]: ["avail-1"],
          },
        };
        return selector(state);
      }
    );

    // 4. Mock Utility Function
    (computeTeamOnboardingStep as jest.Mock).mockReturnValue(
      overrides.computedStep ?? 1
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Basic & Loading States ---

  it("returns defaults and redirects if no orgId is provided", () => {
    setupMocks();
    const { result } = renderHook(() => useTeamOnboarding(null));

    expect(result.current.shouldRedirectToOrganizations).toBe(true);
    expect(result.current.step).toBe(0);
    expect(result.current.profile).toBeNull();
  });

  it("returns loading state if Org Store is loading", () => {
    setupMocks({ orgStatus: "loading" });
    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    expect(result.current.step).toBe(0);
    expect(result.current.slots).toEqual([]);
    expect(result.current.shouldRedirectToOrganizations).toBe(false);
    // Profile is null during loading return block
    expect(result.current.profile).toBeNull();
  });

  it("returns loading state if Availability Store is idle", () => {
    setupMocks({ availabilityStatus: "idle" });
    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    expect(result.current.step).toBe(0);
  });

  // --- 2. Logic: Missing Data & Redirects ---

  it("redirects if membership is missing", () => {
    setupMocks({ membershipsByOrgId: {} }); // No membership for mockOrgId
    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    expect(result.current.shouldRedirectToOrganizations).toBe(true);
    expect(result.current.profile).toBeNull();
  });

  it("halts but does NOT redirect if profile is missing (waiting for fetch)", () => {
    setupMocks({ profilesByOrgId: {} }); // No profile
    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    // Not redirecting because we might just be waiting for profile data load
    // or user needs to create one (handled by UI state typically)
    expect(result.current.shouldRedirectToOrganizations).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.step).toBe(0);
  });

  // --- 3. Logic: Role Based (Owner) ---

  it("skips onboarding (step 3) if user is 'owner'", () => {
    setupMocks({
      membershipsByOrgId: {
        [mockOrgId]: { roleCode: "owner" },
      },
    });

    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    expect(result.current.step).toBe(3);
    expect(result.current.shouldRedirectToOrganizations).toBe(false);
    // Profile is returned as null in the owner shortcut block in the source code
    expect(result.current.profile).toBeNull();
  });

  it("handles 'Owner' case-insensitively via roleDisplay", () => {
    setupMocks({
      membershipsByOrgId: {
        [mockOrgId]: { roleDisplay: "OWNER" },
      },
    });

    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    expect(result.current.step).toBe(3);
  });

  // --- 4. Logic: Standard Flow (Staff) ---

  it("computes step and returns data for standard staff user", () => {
    setupMocks({ computedStep: 2 });
    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    expect(result.current.step).toBe(2);
    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.slots).toEqual([mockAvailabilities[0]]);
    expect(result.current.shouldRedirectToOrganizations).toBe(false);

    // Verify utility called with correct args
    expect(computeTeamOnboardingStep).toHaveBeenCalledWith(
      mockProfile,
      [mockAvailabilities[0]]
    );
  });

  it("handles missing availability slots gracefully", () => {
    setupMocks({
      availabilityIdsByOrgId: {}, // No IDs mapped
    });

    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    expect(result.current.slots).toEqual([]);
    expect(computeTeamOnboardingStep).toHaveBeenCalledWith(mockProfile, []);
  });

  it("filters out null availabilities if ID lookup fails", () => {
    setupMocks({
      availabilityIdsByOrgId: { [mockOrgId]: ["missing-id"] },
      availabilitiesById: {}, // Empty record
    });

    const { result } = renderHook(() => useTeamOnboarding(mockOrgId));

    expect(result.current.slots).toEqual([]);
  });
});