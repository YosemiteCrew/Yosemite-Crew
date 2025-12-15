import {
  loadTeam,
  sendInvite,
  loadInvites,
  acceptInvite,
  getProfileForUserForPrimaryOrg,
} from "../../services/teamService";
import { getData, postData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { useTeamStore } from "../../stores/teamStore";
import { loadOrgs } from "../../services/orgService";
import { loadProfiles } from "../../services/profileService";
import { fromUserOrganizationRequestDTO } from "@yosemite-crew/types";
import { TeamFormDataType, Invite } from "../../types/team";

// --- Mocks ---

// 1. Mock Axios
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;

// 2. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../stores/teamStore", () => ({
  useTeamStore: {
    getState: jest.fn(),
  },
}));

// 3. Mock Dependent Services
jest.mock("../../services/orgService", () => ({
  loadOrgs: jest.fn(),
}));

jest.mock("../../services/profileService", () => ({
  loadProfiles: jest.fn(),
}));

// 4. Mock External Utils
jest.mock("@yosemite-crew/types", () => ({
  fromUserOrganizationRequestDTO: jest.fn(),
}));
const mockedFromDTO = fromUserOrganizationRequestDTO as jest.Mock;

describe("Team Service", () => {
  // Store spies
  const mockTeamStoreStartLoading = jest.fn();
  const mockTeamStoreSetTeams = jest.fn();
  const mockOrgStoreSetPrimary = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Store State Setup
    (useTeamStore.getState as jest.Mock).mockReturnValue({
      startLoading: mockTeamStoreStartLoading,
      setTeamsForOrg: mockTeamStoreSetTeams,
      status: "idle",
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
      setPrimaryOrg: mockOrgStoreSetPrimary,
    });
  });

  // --- Section 1: loadTeam ---
  describe("loadTeam", () => {
    it("returns empty array and warns if no primaryOrgId is selected", async () => {
      // Mock missing org
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await loadTeam();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot send invite.");
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("skips fetch if status is 'loaded' and not forced", async () => {
      (useTeamStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockTeamStoreStartLoading,
      });

      await loadTeam();

      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it("fetches if forced even when loaded", async () => {
      (useTeamStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockTeamStoreStartLoading,
        setTeamsForOrg: mockTeamStoreSetTeams,
      });

      mockedGetData.mockResolvedValue({ data: [] });

      await loadTeam({ force: true });

      expect(mockedGetData).toHaveBeenCalled();
    });

    it("fetches successfully, maps data, and updates store", async () => {
      // Mock raw API response
      const apiResponse = [
        {
          name: "Dr. House",
          profileUrl: "url",
          speciality: "Diagnostics",
          count: 5,
          weeklyHours: 40,
          currentStatus: "Active",
          userOrganisation: { some: "dto" },
        },
      ];
      mockedGetData.mockResolvedValue({ data: apiResponse });

      // Mock DTO transformation
      mockedFromDTO.mockReturnValue({
        practitionerReference: "prac-1",
        organizationReference: "org-123",
        roleCode: "Doctor",
      });

      await loadTeam();

      expect(mockTeamStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith("/fhir/v1/user-organization/org/mapping/org-123");
      expect(mockedFromDTO).toHaveBeenCalledWith({ some: "dto" });

      // Verify mapped object passed to store
      expect(mockTeamStoreSetTeams).toHaveBeenCalledWith("org-123", [
        expect.objectContaining({
          _id: "prac-1",
          organisationId: "org-123",
          name: "Dr. House",
          role: "Doctor",
          todayAppointment: 5,
        }),
      ]);
    });

    it("does not trigger startLoading if silent option is true", async () => {
      mockedGetData.mockResolvedValue({ data: [] });
      await loadTeam({ silent: true });
      expect(mockTeamStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalled();
    });

    it("handles errors gracefully", async () => {
      const error = new Error("Network Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(loadTeam()).rejects.toThrow("Network Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to load invites:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: sendInvite ---
  describe("sendInvite", () => {
    const mockInvite: TeamFormDataType = {
      speciality: { key: "dept-1", label: "Surgery" },
      email: "test@example.com",
      role: "Admin",
      type: "Full-Time",
    } as any;

    it("throws error if primaryOrgId is missing", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await expect(sendInvite(mockInvite)).rejects.toThrow("No primary organization selected");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("sends POST request with correct body on success", async () => {
      mockedPostData.mockResolvedValue({});

      await sendInvite(mockInvite);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/fhir/v1/organization/org-123/invites",
        {
          departmentId: "dept-1",
          inviteeEmail: "test@example.com",
          role: "Admin",
          employmentType: "Full-Time",
        }
      );
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("API Error");
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(sendInvite(mockInvite)).rejects.toThrow("API Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to add team:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: loadInvites ---
  describe("loadInvites", () => {
    it("fetches and transforms invites", async () => {
      const mockRawInvites = [
        {
          someMeta: "meta",
          invite: { id: "inv-1", email: "a@b.com" },
        },
      ];
      mockedGetData.mockResolvedValue({ data: mockRawInvites });

      const result = await loadInvites();

      expect(mockedGetData).toHaveBeenCalledWith("/fhir/v1/organisation-invites/me/pending");
      // Verify spread logic { ...invite.invite, ...invite }
      expect(result).toEqual([
        {
          id: "inv-1",
          email: "a@b.com",
          someMeta: "meta",
          invite: { id: "inv-1", email: "a@b.com" },
        },
      ]);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Fetch Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(loadInvites()).rejects.toThrow("Fetch Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load invites:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: acceptInvite & getProfileForUser ---
  describe("acceptInvite", () => {
    it("accepts invite, reloads data, and sets primary org", async () => {
      const inviteMock: Invite = {
        token: "tok-123",
        organisationId: "org-new",
      } as unknown as Invite;

      mockedPostData.mockResolvedValue({});
      // We need to ensure loadTeam (which is imported in the same file) doesn't fail
      // Since loadTeam calls useTeamStore/getData, our mocks handle it, but we can verify it was called by checking side effects if needed,
      // or rely on the fact that if it threw, this test would fail.
      // NOTE: Jest handles circular/internal calls fine usually.

      // Setup successful response for the internal loadTeam call
      mockedGetData.mockResolvedValue({ data: [] });

      await acceptInvite(inviteMock);

      expect(mockedPostData).toHaveBeenCalledWith("/fhir/v1/organisation-invites/tok-123/accept");
      expect(loadOrgs).toHaveBeenCalledWith({ silent: true });
      expect(loadProfiles).toHaveBeenCalledWith({ silent: true });
      // Verify setPrimaryOrg was called with the invite's orgId
      expect(mockOrgStoreSetPrimary).toHaveBeenCalledWith("org-new");
    });
  });

  describe("getProfileForUserForPrimaryOrg", () => {
    it("warns and returns empty array if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await getProfileForUserForPrimaryOrg("user-1");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot load companions.");
      consoleSpy.mockRestore();
    });

    it("returns empty array if userId is missing", async () => {
      const result = await getProfileForUserForPrimaryOrg("");
      expect(result).toEqual([]);
      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it("fetches profile successfully", async () => {
      const mockProfileData = { id: "prof-1" };
      mockedGetData.mockResolvedValue({ data: mockProfileData });

      const result = await getProfileForUserForPrimaryOrg("user-1");

      expect(mockedGetData).toHaveBeenCalledWith("/fhir/v1/user-profile/user-1/org-123/profile");
      expect(result).toEqual(mockProfileData);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Profile Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(getProfileForUserForPrimaryOrg("user-1")).rejects.toThrow("Profile Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });
});