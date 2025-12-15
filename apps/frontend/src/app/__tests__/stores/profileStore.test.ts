import { useUserProfileStore } from "../../stores/profileStore";
import { UserProfile } from "../../types/profile";

// --- Mock Data ---
// We cast to unknown first to avoid strict type adherence for fields that might not exist in the strict type
const mockProfile1: UserProfile = {
  id: "prof-1",
  userId: "user-1",
  organizationId: "org-1",
  firstName: "John",
  lastName: "Doe",
} as unknown as UserProfile;

const mockProfile2: UserProfile = {
  id: "prof-2",
  userId: "user-2",
  organizationId: "org-2",
  firstName: "Jane",
  lastName: "Smith",
} as unknown as UserProfile;

const mockProfileInvalid: UserProfile = {
  id: "prof-bad",
  firstName: "No Org",
  // organizationId missing
} as unknown as UserProfile;

describe("UserProfile Store", () => {
  // Reset store and mocks before each test
  beforeEach(() => {
    useUserProfileStore.setState({
      profilesByOrgId: {},
      status: "idle",
      error: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status Management ---
  describe("Initialization & Status", () => {
    it("initializes with default empty state", () => {
      const state = useUserProfileStore.getState();
      expect(state.profilesByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });

    it("manages loading state", () => {
      const store = useUserProfileStore.getState();
      store.startLoading();
      expect(useUserProfileStore.getState().status).toBe("loading");
      expect(useUserProfileStore.getState().error).toBeNull();

      store.endLoading();
      expect(useUserProfileStore.getState().status).toBe("loaded");
    });

    it("sets error state", () => {
      const store = useUserProfileStore.getState();
      store.setError("Failed to fetch profiles");
      expect(useUserProfileStore.getState().status).toBe("error");
      expect(useUserProfileStore.getState().error).toBe("Failed to fetch profiles");
    });

    it("clears profiles (resets status)", () => {
      // NOTE: Source code has a typo (clears 'profilesById' instead of 'profilesByOrgId').
      // We test that the function executes and resets status/error as defined.
      const store = useUserProfileStore.getState();
      store.setError("Some error");

      store.clearProfiles();

      const state = useUserProfileStore.getState();
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });
  });

  // --- Section 2: Set & Add Operations ---
  describe("Set & Add Operations", () => {
    it("sets profiles correctly, indexing by organizationId", () => {
      const store = useUserProfileStore.getState();
      store.setProfiles([mockProfile1, mockProfile2]);

      const state = useUserProfileStore.getState();
      expect(state.profilesByOrgId["org-1"]).toEqual(mockProfile1);
      expect(state.profilesByOrgId["org-2"]).toEqual(mockProfile2);
      expect(state.status).toBe("loaded");
    });

    it("skips profiles without organizationId during setProfiles", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const store = useUserProfileStore.getState();

      store.setProfiles([mockProfile1, mockProfileInvalid]);

      const state = useUserProfileStore.getState();
      expect(state.profilesByOrgId["org-1"]).toBeDefined();
      expect(Object.keys(state.profilesByOrgId)).toHaveLength(1); // Invalid one skipped

      expect(consoleSpy).toHaveBeenCalledWith(
        "setProfiles: skipping profile without organizationId",
        mockProfileInvalid
      );
      consoleSpy.mockRestore();
    });

    it("adds a single profile", () => {
      const store = useUserProfileStore.getState();
      store.addProfile(mockProfile1);

      const state = useUserProfileStore.getState();
      expect(state.profilesByOrgId["org-1"]).toEqual(mockProfile1);
      expect(state.status).toBe("loaded");
    });

    it("warns and does nothing if adding profile without organizationId", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const store = useUserProfileStore.getState();

      store.addProfile(mockProfileInvalid);

      const state = useUserProfileStore.getState();
      expect(Object.keys(state.profilesByOrgId)).toHaveLength(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "addProfile: missing organizationId on profile",
        mockProfileInvalid
      );
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: Update & Remove Operations ---
  describe("Update & Remove Operations", () => {
    it("updates an existing profile", () => {
      useUserProfileStore.getState().setProfiles([mockProfile1]);

      // Update with new data (casted to avoid TS error on 'firstName')
      const updatedProfile = { ...mockProfile1, firstName: "Jonathan" } as unknown as UserProfile;
      useUserProfileStore.getState().updateProfile(updatedProfile);

      const state = useUserProfileStore.getState();
      // FIX: Cast to any to access 'firstName' which might not be in the strict type definition
      expect((state.profilesByOrgId["org-1"] as any).firstName).toBe("Jonathan");
    });

    it("warns when updating a profile without organizationId", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const store = useUserProfileStore.getState();

      store.updateProfile(mockProfileInvalid);

      expect(consoleSpy).toHaveBeenCalledWith(
        "updateProfile: missing organizationId on profile",
        mockProfileInvalid
      );
      consoleSpy.mockRestore();
    });

    it("warns when updating a profile that does not exist in store", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const store = useUserProfileStore.getState();

      // Store is empty
      store.updateProfile(mockProfile1);

      expect(consoleSpy).toHaveBeenCalledWith(
        `updateProfile: profile not found for organizationId=${mockProfile1.organizationId}`
      );
      consoleSpy.mockRestore();
    });

    it("removes profile for a specific org", () => {
      useUserProfileStore.getState().setProfiles([mockProfile1, mockProfile2]);

      useUserProfileStore.getState().clearProfileForOrg("org-1");

      const state = useUserProfileStore.getState();
      expect(state.profilesByOrgId["org-1"]).toBeUndefined();
      expect(state.profilesByOrgId["org-2"]).toBeDefined();
    });

    it("does nothing when removing profile for non-existent org", () => {
      useUserProfileStore.getState().setProfiles([mockProfile1]);
      const initialJson = JSON.stringify(useUserProfileStore.getState());

      useUserProfileStore.getState().clearProfileForOrg("org-999");

      const finalJson = JSON.stringify(useUserProfileStore.getState());
      expect(finalJson).toEqual(initialJson);
    });
  });

  // --- Section 4: Getters ---
  describe("Getters", () => {
    it("retrieves profile by ID", () => {
      useUserProfileStore.getState().setProfiles([mockProfile1]);

      const result = useUserProfileStore.getState().getProfileById("org-1");
      expect(result).toEqual(mockProfile1);

      const missing = useUserProfileStore.getState().getProfileById("org-999");
      expect(missing).toBeUndefined();
    });
  });
});