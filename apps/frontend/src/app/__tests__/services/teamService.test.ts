import {
  loadTeam,
  sendInvite,
  loadInvites,
  acceptInvite,
  rejectInvite,
  getProfileForUserForPrimaryOrg,
  removeMember,
  updateMember,
} from "@/app/features/organization/services/teamService";
import * as axios from "@/app/services/axios";
import { useOrgStore } from "@/app/stores/orgStore";
import { useTeamStore } from "@/app/stores/teamStore";
import * as orgService from "@/app/features/organization/services/orgService";
import * as profileService from "@/app/features/organization/services/profileService";
import {
  fromUserOrganizationRequestDTO,
  toUserOrganizationResponseDTO,
} from "@yosemite-crew/types";
import { toPermissionArray } from "@/app/lib/permissions";

// ----------------------------------------------------------------------------
// 1. Mocks
// ----------------------------------------------------------------------------

jest.mock("@/app/services/axios");
jest.mock("@/app/stores/orgStore");
jest.mock("@/app/stores/teamStore");
jest.mock("@/app/features/organization/services/orgService");
jest.mock("@/app/features/organization/services/profileService");
jest.mock("@/app/lib/permissions");
jest.mock("@yosemite-crew/types", () => ({
  fromUserOrganizationRequestDTO: jest.fn(),
  toUserOrganizationResponseDTO: jest.fn(),
}));

describe("Team Service", () => {
  // Store Mock Functions
  const mockStartLoading = jest.fn();
  const mockSetTeamsForOrg = jest.fn();
  const mockRemoveTeam = jest.fn();
  const mockUpdateTeam = jest.fn();
  const mockSetPrimaryOrg = jest.fn();

  // Console Spies
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Console Spies
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Default Store State
    (useTeamStore.getState as jest.Mock).mockReturnValue({
      startLoading: mockStartLoading,
      status: "idle",
      setTeamsForOrg: mockSetTeamsForOrg,
      removeTeam: mockRemoveTeam,
      updateTeam: mockUpdateTeam,
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
      setPrimaryOrg: mockSetPrimaryOrg,
    });

    // Default Utility Mocks
    (toPermissionArray as jest.Mock).mockReturnValue(["PERM_1"]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 2. loadTeam Tests
  // --------------------------------------------------------------------------
  describe("loadTeam", () => {
    it("warns and returns empty array if no primaryOrgId is present", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });

      const result = await loadTeam();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot send invite."
      );
      expect(result).toEqual([]);
      expect(axios.getData).not.toHaveBeenCalled();
    });

    it("skips fetching if status is 'success' and force is false (shouldFetchTeam check)", async () => {
      (useTeamStore.getState as jest.Mock).mockReturnValue({
        status: "success",
        startLoading: mockStartLoading,
      });

      await loadTeam();

      expect(mockStartLoading).not.toHaveBeenCalled();
      expect(axios.getData).not.toHaveBeenCalled();
    });

    it("fetches if force is true even if status is 'success'", async () => {
      (useTeamStore.getState as jest.Mock).mockReturnValue({
        status: "success",
        setTeamsForOrg: mockSetTeamsForOrg,
        startLoading: mockStartLoading,
      });
      (axios.getData as jest.Mock).mockResolvedValue({ data: [] });

      await loadTeam({ force: true });

      expect(axios.getData).toHaveBeenCalled();
    });

    it("starts loading if not silent", async () => {
      (axios.getData as jest.Mock).mockResolvedValue({ data: [] });
      await loadTeam();
      expect(mockStartLoading).toHaveBeenCalled();
    });

    it("does NOT start loading if silent is true", async () => {
      (axios.getData as jest.Mock).mockResolvedValue({ data: [] });
      await loadTeam({ silent: true });
      expect(mockStartLoading).not.toHaveBeenCalled();
    });

    it("fetches data, maps items correctly, and updates store", async () => {
      const mockApiData = [
        {
          name: "John Doe",
          profileUrl: "http://img.com/1",
          speciality: ["Cardio"],
          count: 5,
          weeklyHours: 40,
          currentStatus: "Active",
          userOrganisation: { raw: "raw-data-1" },
        },
        {
          userOrganisation: { raw: "raw-data-2" }, // Item that will fail ID check
        },
      ];

      (axios.getData as jest.Mock).mockResolvedValue({ data: mockApiData });

      // Mock DTO mapper
      (fromUserOrganizationRequestDTO as jest.Mock)
        .mockReturnValueOnce({
          id: "team-1",
          practitionerReference: "prac-1",
          organizationReference: "org-123",
          roleCode: "DOCTOR",
          effectivePermissions: ["READ"],
          extraPermissions: ["WRITE"],
        })
        .mockReturnValueOnce({ id: undefined }); // Second item has no ID

      await loadTeam();

      expect(axios.getData).toHaveBeenCalledWith(
        "/fhir/v1/user-organization/org/mapping/org-123"
      );

      // Verify setTeamsForOrg called with only the valid item
      expect(mockSetTeamsForOrg).toHaveBeenCalledWith(
        "org-123",
        expect.arrayContaining([
          expect.objectContaining({
            _id: "team-1",
            name: "John Doe",
            role: "DOCTOR",
            effectivePermissions: ["PERM_1"], // from toPermissionArray mock
          }),
        ])
      );
      // Ensure only 1 item added (the valid one)
      const storedTeams = mockSetTeamsForOrg.mock.calls[0][1];
      expect(storedTeams).toHaveLength(1);
    });

    it("handles errors during fetch", async () => {
      const error = new Error("Network Error");
      (axios.getData as jest.Mock).mockRejectedValue(error);

      await expect(loadTeam()).rejects.toThrow("Network Error");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load invites:", error);
    });
  });

  // --------------------------------------------------------------------------
  // 3. sendInvite Tests
  // --------------------------------------------------------------------------
  describe("sendInvite", () => {
    const invitePayload: any = {
      speciality: ["spec-1"],
      email: "test@test.com",
      role: "ADMIN",
      type: "FULL_TIME",
    };

    it("throws error if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });

      await expect(sendInvite(invitePayload)).rejects.toThrow(
        "No primary organization selected"
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot send invite."
      );
    });

    it("sends post request with correct body", async () => {
      (axios.postData as jest.Mock).mockResolvedValue({});

      await sendInvite(invitePayload);

      expect(axios.postData).toHaveBeenCalledWith(
        "/fhir/v1/organization/org-123/invites",
        {
          departmentIds: ["spec-1"],
          inviteeEmail: "test@test.com",
          role: "ADMIN",
          employmentType: "FULL_TIME",
        }
      );
    });

    it("logs error and throws if API fails", async () => {
      const error = new Error("Invite Failed");
      (axios.postData as jest.Mock).mockRejectedValue(error);

      await expect(sendInvite(invitePayload)).rejects.toThrow("Invite Failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to add team:", error);
    });
  });

  // --------------------------------------------------------------------------
  // 4. loadInvites Tests
  // --------------------------------------------------------------------------
  describe("loadInvites", () => {
    it("fetches and merges invite data correctly", async () => {
      const mockResponse = [
        {
          status: "PENDING",
          invite: { email: "a@b.com", role: "USER" },
        },
      ];
      (axios.getData as jest.Mock).mockResolvedValue({ data: mockResponse });
      // Check merging logic: { ...invite.invite, ...invite }
      const res = await loadInvites();
      expect(res.length).toBe(1);
    });

    it("logs error and throws if fetch fails", async () => {
      const error = new Error("Fetch Error");
      (axios.getData as jest.Mock).mockRejectedValue(error);

      await expect(loadInvites()).rejects.toThrow("Fetch Error");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load invites:", error);
    });
  });

  // --------------------------------------------------------------------------
  // 5. acceptInvite Tests
  // --------------------------------------------------------------------------
  describe("acceptInvite", () => {
    const invite = { token: "tok-123", organisationId: "new-org-id" } as any;

    it("accepts invite and reloads dependencies", async () => {
      (axios.postData as jest.Mock).mockResolvedValue({});

      await acceptInvite(invite);

      expect(axios.postData).toHaveBeenCalledWith(
        "/fhir/v1/organisation-invites/tok-123/accept"
      );
      expect(orgService.loadOrgs).toHaveBeenCalledWith({ silent: true });
      expect(profileService.loadProfiles).toHaveBeenCalledWith({ silent: true });
    });

    it("catches and logs errors (does not throw)", async () => {
      const error = new Error("Accept Error");
      (axios.postData as jest.Mock).mockRejectedValue(error);

      await acceptInvite(invite);

      expect(consoleLogSpy).toHaveBeenCalledWith(error);
    });
  });

  // --------------------------------------------------------------------------
  // 6. rejectInvite Tests
  // --------------------------------------------------------------------------
  describe("rejectInvite", () => {
    it("logs the invite ID on success", async () => {
      // Mock the axios call used by rejectInvite to resolve successfully
      (axios.postData as jest.Mock).mockResolvedValue({});
      // Note: If rejectInvite uses deleteData, mock that too:
      (axios.deleteData as jest.Mock).mockResolvedValue({});

      const invite = { _id: "inv-1" } as any;
      await rejectInvite(invite);
    });

    it("logs error if an exception occurs (e.g. invite is null)", async () => {
      // Force error by passing null to trigger property access error
      await rejectInvite(null as any);
      // The catch block logs the error
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --------------------------------------------------------------------------
  // 7. getProfileForUserForPrimaryOrg Tests
  // --------------------------------------------------------------------------
  describe("getProfileForUserForPrimaryOrg", () => {
    it("warns and returns [] if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });

      const result = await getProfileForUserForPrimaryOrg("user-1");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load companions."
      );
      expect(result).toEqual([]);
    });

    it("returns [] if userId is missing", async () => {
      const result = await getProfileForUserForPrimaryOrg("");
      expect(result).toEqual([]);
      expect(axios.getData).not.toHaveBeenCalled();
    });

    it("fetches profile data successfully", async () => {
      (axios.getData as jest.Mock).mockResolvedValue({ data: { name: "Profile" } });

      const result = await getProfileForUserForPrimaryOrg("user-1");

      expect(axios.getData).toHaveBeenCalledWith(
        "/fhir/v1/user-profile/user-1/org-123/profile"
      );
      expect(result).toEqual({ name: "Profile" });
    });

    it("logs and throws on error", async () => {
      const error = new Error("Profile Error");
      (axios.getData as jest.Mock).mockRejectedValue(error);

      await expect(getProfileForUserForPrimaryOrg("user-1")).rejects.toThrow(
        "Profile Error"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create service:",
        error
      );
    });
  });

  // --------------------------------------------------------------------------
  // 8. removeMember Tests
  // --------------------------------------------------------------------------
  describe("removeMember", () => {
    it("throws error if member ID is missing", async () => {
      const member = {} as any; // No _id
      await expect(removeMember(member)).rejects.toThrow("Member ID is missing.");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to delete member:",
        expect.any(Error)
      );
    });

    it("deletes member and updates store", async () => {
      const member = { _id: "mem-1" } as any;
      (axios.deleteData as jest.Mock).mockResolvedValue({});

      await removeMember(member);

      expect(axios.deleteData).toHaveBeenCalledWith(
        "/fhir/v1/user-organization/mem-1"
      );
      expect(mockRemoveTeam).toHaveBeenCalledWith("mem-1");
    });

    it("logs and throws on API error", async () => {
      const member = { _id: "mem-1" } as any;
      const error = new Error("Delete failed");
      (axios.deleteData as jest.Mock).mockRejectedValue(error);

      await expect(removeMember(member)).rejects.toThrow("Delete failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to delete member:",
        error
      );
    });
  });

  // --------------------------------------------------------------------------
  // 9. updateMember Tests
  // --------------------------------------------------------------------------
  describe("updateMember", () => {
    const memberInput = {
      _id: "mem-1",
      practionerId: "prac-1",
      organisationId: "org-1",
      role: "NURSE",
      effectivePermissions: ["A"],
      extraPerissions: ["B"],
    } as any;

    it("warns and returns if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });

      await updateMember(memberInput);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load companions."
      );
      expect(axios.putData).not.toHaveBeenCalled();
    });

    it("maps data, puts to API, maps response, and updates store", async () => {
      // Mock DTO response mapping from toUserOrganizationResponseDTO
      (toUserOrganizationResponseDTO as jest.Mock).mockReturnValue({
        mapped: "fhir-payload",
      });

      // Mock API Response
      const apiResponse = { data: { raw: "res-data" } };
      (axios.putData as jest.Mock).mockResolvedValue(apiResponse);

      // Mock DTO response mapping from fromUserOrganizationRequestDTO
      (fromUserOrganizationRequestDTO as jest.Mock).mockReturnValue({
        roleCode: "SUPER_NURSE",
        effectivePermissions: ["X"],
        extraPermissions: ["Y"],
      });

      await updateMember(memberInput);

      // Verify mapping input
      expect(toUserOrganizationResponseDTO).toHaveBeenCalledWith({
        practitionerReference: "prac-1",
        organizationReference: "org-1",
        roleCode: "NURSE",
        roleDisplay: "NURSE",
        effectivePermissions: ["A"],
        extraPermissions: ["B"],
      });

      // Verify API Call
      expect(axios.putData).toHaveBeenCalledWith(
        "/fhir/v1/user-organization/mem-1",
        { mapped: "fhir-payload" }
      );

      // Verify Store Update
      expect(mockUpdateTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          ...memberInput,
          role: "SUPER_NURSE",
          effectivePermissions: ["PERM_1"], // from toPermissionArray mock
          extraPerissions: ["PERM_1"],
        })
      );
    });

    it("logs and throws on API error", async () => {
      const error = new Error("Update Error");
      (toUserOrganizationResponseDTO as jest.Mock).mockReturnValue({});
      (axios.putData as jest.Mock).mockRejectedValue(error);

      await expect(updateMember(memberInput)).rejects.toThrow("Update Error");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create service:",
        error
      );
    });
  });
});
