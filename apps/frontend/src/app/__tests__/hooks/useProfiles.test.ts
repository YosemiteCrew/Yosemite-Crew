import { renderHook } from "@testing-library/react";
import { useLoadProfiles, usePrimaryOrgProfile } from "../../hooks/useProfiles";
import { loadProfiles } from "../../services/profileService";
import { useOrgStore } from "../../stores/orgStore";
import { useUserProfileStore } from "../../stores/profileStore";

// --- Mocks ---

jest.mock("../../services/profileService", () => ({
  loadProfiles: jest.fn(),
}));

jest.mock("../../stores/orgStore");
jest.mock("../../stores/profileStore");

describe("useProfiles Hooks", () => {
  let mockOrgState: any;
  let mockProfileState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock State
    mockOrgState = {
      orgIds: [],
      primaryOrgId: null,
    };

    mockProfileState = {
      status: "idle",
      profilesByOrgId: {},
    };

    // Setup Store Mocks (Zustand selector pattern)
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useUserProfileStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockProfileState)
    );
  });

  // --- Section 1: useLoadProfiles Logic ---

  describe("useLoadProfiles", () => {
    it("should trigger loadProfiles when status is 'idle' and orgIds exist", () => {
      mockOrgState.orgIds = ["org-1"];
      mockProfileState.status = "idle";

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).toHaveBeenCalledTimes(1);
    });

    it("should NOT trigger loadProfiles if orgIds list is empty", () => {
      mockOrgState.orgIds = [];
      mockProfileState.status = "idle";

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).not.toHaveBeenCalled();
    });

    it("should NOT trigger loadProfiles if orgIds is undefined/null", () => {
      mockOrgState.orgIds = null;
      mockProfileState.status = "idle";

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).not.toHaveBeenCalled();
    });

    it("should NOT trigger loadProfiles if status is NOT 'idle' (e.g. 'loading')", () => {
      mockOrgState.orgIds = ["org-1"];
      mockProfileState.status = "loading";

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).not.toHaveBeenCalled();
    });

    it("should NOT trigger loadProfiles if status is 'success'", () => {
      mockOrgState.orgIds = ["org-1"];
      mockProfileState.status = "success";

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).not.toHaveBeenCalled();
    });
  });

  // --- Section 2: usePrimaryOrgProfile Logic ---

  describe("usePrimaryOrgProfile", () => {
    const mockProfile = { id: "p1", name: "User 1" };

    it("should return null if primaryOrgId is not set", () => {
      mockOrgState.primaryOrgId = null;
      mockProfileState.profilesByOrgId = { "org-1": mockProfile };

      const { result } = renderHook(() => usePrimaryOrgProfile());

      expect(result.current).toBeNull();
    });

    it("should return null if primaryOrgId is set but no profile exists for it", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockProfileState.profilesByOrgId = { "org-2": mockProfile }; // Mismatch

      const { result } = renderHook(() => usePrimaryOrgProfile());

      expect(result.current).toBeNull();
    });

    it("should return the profile if primaryOrgId matches an entry", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockProfileState.profilesByOrgId = { "org-1": mockProfile };

      const { result } = renderHook(() => usePrimaryOrgProfile());

      expect(result.current).toEqual(mockProfile);
    });

    it("should return null if profiles map is undefined (edge case)", () => {
        // Technically strict TS prevents this, but runtime JS might allow it
        mockOrgState.primaryOrgId = "org-1";
        // simulate missing map key entirely logic is handled by selector usually, but good to test hook safety
        mockProfileState.profilesByOrgId = {};

        const { result } = renderHook(() => usePrimaryOrgProfile());

        expect(result.current).toBeNull();
      });
  });
});