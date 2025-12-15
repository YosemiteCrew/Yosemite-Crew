import {
  loadProfiles,
  createUserProfile,
  updateUserProfile,
  upsertUserProfile,
} from "../../services/profileService";
import { getData, postData, putData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { useUserProfileStore } from "../../stores/profileStore";
import { UserProfile } from "../../types/profile";

// --- Mocks ---

// 1. Mock Axios Helpers
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedPutData = putData as jest.Mock;

// 2. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../stores/profileStore", () => ({
  useUserProfileStore: {
    getState: jest.fn(),
  },
}));

describe("Profile Service", () => {
  // Store Spies
  const mockProfileStoreStartLoading = jest.fn();
  const mockProfileStoreSetProfiles = jest.fn();
  const mockProfileStoreAddProfile = jest.fn();
  const mockProfileStoreUpdateProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Profile Store State
    (useUserProfileStore.getState as jest.Mock).mockReturnValue({
      startLoading: mockProfileStoreStartLoading,
      setProfiles: mockProfileStoreSetProfiles,
      addProfile: mockProfileStoreAddProfile,
      updateProfile: mockProfileStoreUpdateProfile,
    });

    // Default Org Store State (Empty by default)
    (useOrgStore.getState as jest.Mock).mockReturnValue({
      orgIds: [],
    });
  });

  // --- Section 1: loadProfiles ---
  describe("loadProfiles", () => {
    it("returns early if no orgIds exist", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ orgIds: [] });

      await loadProfiles();

      expect(mockProfileStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).not.toHaveBeenCalled();
      // Even if empty, it usually calls setProfiles([]) or similar, but the implementation provided
      // returns undefined if length is 0 inside the try block, so setProfiles is NOT called.
      expect(mockProfileStoreSetProfiles).not.toHaveBeenCalled();
    });

    it("fetches profiles for multiple orgs and aggregates results", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ orgIds: ["org-1", "org-2"] });

      // Mock responses based on URL
      mockedGetData.mockImplementation((url) => {
        if (url.includes("org-1")) return Promise.resolve({ data: { profile: { id: "prof-1" } } });
        if (url.includes("org-2")) return Promise.resolve({ data: { profile: { id: "prof-2" } } });
        return Promise.reject(new Error("Unknown URL"));
      });

      await loadProfiles();

      expect(mockProfileStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledTimes(2);
      expect(mockProfileStoreSetProfiles).toHaveBeenCalledWith([
        { id: "prof-1" },
        { id: "prof-2" },
      ]);
    });

    it("handles partial failures (Promise.allSettled) gracefully", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ orgIds: ["org-success", "org-fail"] });
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      // Success for first, Fail for second
      mockedGetData.mockImplementation((url) => {
        if (url.includes("org-success")) return Promise.resolve({ data: { profile: { id: "prof-ok" } } });
        if (url.includes("org-fail")) return Promise.reject(new Error("Fetch Error"));
        return Promise.resolve({});
      });

      await loadProfiles();

      // Should still set profiles for the ones that succeeded
      expect(mockProfileStoreSetProfiles).toHaveBeenCalledWith([{ id: "prof-ok" }]);

      // Verify error logging for individual failure
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch profile for orgId: org-fail",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("suppresses loading state if silent option is true", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ orgIds: ["org-1"] });
      mockedGetData.mockResolvedValue({ data: { profile: {} } });

      await loadProfiles({ silent: true });

      expect(mockProfileStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalled();
    });

    it("catches and rethrows top-level errors (outside the loop)", async () => {
      // Simulate an error inside the service function logic itself (e.g. setProfiles fails)
      (useOrgStore.getState as jest.Mock).mockReturnValue({ orgIds: ["org-1"] });
      mockedGetData.mockResolvedValue({ data: { profile: {} } });

      const error = new Error("Store Error");
      mockProfileStoreSetProfiles.mockImplementation(() => { throw error; });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(loadProfiles()).rejects.toThrow("Store Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to load orgs:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: createUserProfile ---
  describe("createUserProfile", () => {
    // FIX: Cast to 'unknown' first to bypass strict type overlap check
    const mockInput = { firstName: "John" } as unknown as UserProfile;

    it("returns early if orgIdFromQuery is null", async () => {
      await createUserProfile(mockInput, null);

      expect(mockProfileStoreStartLoading).toHaveBeenCalled();
      expect(mockedPostData).not.toHaveBeenCalled();
    });

    it("sends POST request and updates store on success", async () => {
      const mockResponse = {
        _id: "prof-new",
        organizationId: "org-1",
        personalDetails: { age: 30 },
      };
      mockedPostData.mockResolvedValue({ data: mockResponse });

      await createUserProfile(mockInput, "org-1");

      expect(mockProfileStoreStartLoading).toHaveBeenCalled();
      expect(mockedPostData).toHaveBeenCalledWith(
        "/fhir/v1/user-profile/org-1/profile",
        { ...mockInput, organizationId: "org-1" }
      );

      expect(mockProfileStoreAddProfile).toHaveBeenCalledWith({
        _id: "prof-new",
        organizationId: "org-1",
        personalDetails: { age: 30 },
      });
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Create Failed");
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createUserProfile(mockInput, "org-1")).rejects.toThrow("Create Failed");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load orgs:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: updateUserProfile ---
  describe("updateUserProfile", () => {
    // FIX: Cast to 'unknown' first
    const mockInput = { firstName: "Jane" } as unknown as UserProfile;

    it("returns early if orgIdFromQuery is null", async () => {
      await updateUserProfile(mockInput, null);
      expect(mockedPutData).not.toHaveBeenCalled();
    });

    it("sends PUT request and updates store on success", async () => {
      const mockResponseData = { firstName: "Jane", organizationId: "org-2" };
      mockedPutData.mockResolvedValue({ data: mockResponseData });

      await updateUserProfile(mockInput, "org-2");

      expect(mockProfileStoreStartLoading).toHaveBeenCalled();
      expect(mockedPutData).toHaveBeenCalledWith(
        "/fhir/v1/user-profile/org-2/profile",
        { ...mockInput, organizationId: "org-2" }
      );
      expect(mockProfileStoreUpdateProfile).toHaveBeenCalledWith(mockResponseData);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Update Failed");
      mockedPutData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(updateUserProfile(mockInput, "org-2")).rejects.toThrow("Update Failed");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load orgs:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: upsertUserProfile ---
  describe("upsertUserProfile", () => {
    // FIX: Cast to 'unknown' first
    const mockInput = {
      firstName: "Alex",
      organizationId: "org-99"
    } as unknown as UserProfile;

    it("sends PUT request using payload orgId and updates store", async () => {
      const mockResponseData = { ...mockInput, _id: "prof-upsert" };
      mockedPutData.mockResolvedValue({ data: mockResponseData });

      await upsertUserProfile(mockInput);

      expect(mockProfileStoreStartLoading).toHaveBeenCalled();
      expect(mockedPutData).toHaveBeenCalledWith(
        "/fhir/v1/user-profile/org-99/profile",
        mockInput
      );
      expect(mockProfileStoreUpdateProfile).toHaveBeenCalledWith(mockResponseData);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Upsert Failed");
      mockedPutData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(upsertUserProfile(mockInput)).rejects.toThrow("Upsert Failed");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load orgs:", error);
      consoleSpy.mockRestore();
    });
  });
});