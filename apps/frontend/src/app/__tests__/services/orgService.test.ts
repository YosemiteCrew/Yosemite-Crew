import { loadOrgs, createOrg, updateOrg } from "@/app/services/orgService";
import * as axiosService from "@/app/services/axios";
import { useOrgStore } from "@/app/stores/orgStore";
import { useAuthStore } from "@/app/stores/authStore";
import { AxiosError } from "axios";
import {
  fromUserOrganizationRequestDTO,
  fromOrganizationRequestDTO,
  toOrganizationResponseDTO,
} from "@yosemite-crew/types";

// --- Mocks ---

// Mock Axios Service
jest.mock("@/app/services/axios", () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  putData: jest.fn(),
}));

// Mock Types helpers
jest.mock("@yosemite-crew/types", () => ({
  ...jest.requireActual("@yosemite-crew/types"),
  fromUserOrganizationRequestDTO: jest.fn(),
  fromOrganizationRequestDTO: jest.fn(),
  toOrganizationResponseDTO: jest.fn(),
}));

// Mock Stores
const mockOrgStore = {
  startLoading: jest.fn(),
  setOrgs: jest.fn(),
  setError: jest.fn(),
  setUserOrgMappings: jest.fn(),
  upsertOrg: jest.fn(),
  setPrimaryOrg: jest.fn(),
  upsertUserOrgMapping: jest.fn(),
  updateOrg: jest.fn(),
};

const mockAuthStore = {
  user: { getUsername: jest.fn(() => "user-123") },
  attributes: { sub: "sub-123" },
};

// Setup store mocks
useOrgStore.getState = jest.fn(() => mockOrgStore as any);
useAuthStore.getState = jest.fn(() => mockAuthStore as any);

describe("Org Service", () => {
  // Original console.error ref to restore later if needed,
  // though Jest usually handles restore with mockRestore()
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore the mock after every test so we don't affect other suites
    (console.error as jest.Mock).mockRestore();
  });

  // --- loadOrgs Tests ---

  describe("loadOrgs", () => {
    it("fetches and sets organizations successfully", async () => {
      const mockData = [
        {
          mapping: { role: "admin" },
          organization: { name: "Org 1" },
        },
      ];
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: mockData });
      (fromUserOrganizationRequestDTO as jest.Mock).mockReturnValue({ role: "admin" });

      await loadOrgs();

      expect(mockOrgStore.startLoading).toHaveBeenCalled();
      expect(axiosService.getData).toHaveBeenCalledWith(
        "/fhir/v1/user-organization/user/mapping"
      );
      expect(fromUserOrganizationRequestDTO).toHaveBeenCalledWith(mockData[0].mapping);
      expect(mockOrgStore.setOrgs).toHaveBeenCalledWith(
        [{ name: "Org 1" }],
        { keepPrimaryIfPresent: true }
      );
      expect(mockOrgStore.setUserOrgMappings).toHaveBeenCalledWith([{ role: "admin" }]);
    });

    it("does not start loading if silent option is true", async () => {
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: [] });
      await loadOrgs({ silent: true });
      expect(mockOrgStore.startLoading).not.toHaveBeenCalled();
    });

    it("handles 403 error", async () => {
      const error = new AxiosError("Forbidden", "403", undefined, {}, { status: 403 } as any);
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(loadOrgs()).rejects.toThrow(error);

      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "You don't have permission to fetch organizations."
      );
      // Verify console.error was called (optional, but good practice since we are mocking it)
      expect(console.error).toHaveBeenCalledWith("Failed to load orgs:", error);
    });

    it("handles 404 error", async () => {
      const error = new AxiosError("Not Found", "404", undefined, {}, { status: 404 } as any);
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(loadOrgs()).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "Organization service not found. Please contact support."
      );
    });

    it("handles generic axios error with message", async () => {
      const error = new AxiosError("Generic Error", "500", undefined, {}, {
        status: 500,
        data: { message: "Server Error" },
      } as any);
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(loadOrgs()).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith("Server Error");
    });

    it("handles generic axios error without response data", async () => {
        const error = new AxiosError("Network Error");
        (axiosService.getData as jest.Mock).mockRejectedValue(error);

        await expect(loadOrgs()).rejects.toThrow(error);
        expect(mockOrgStore.setError).toHaveBeenCalledWith("Network Error");
      });

    it("handles non-axios errors", async () => {
      const error = new Error("Unknown Error");
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(loadOrgs()).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "Unexpected error while fetching organization"
      );
    });
  });

  // --- createOrg Tests ---

  describe("createOrg", () => {
    const mockFormData: any = { name: "New Org" };

    it("creates an organization successfully", async () => {
      const mockResponse = { _id: "org-1", name: "New Org" };
      (toOrganizationResponseDTO as jest.Mock).mockReturnValue(mockFormData);
      (axiosService.postData as jest.Mock).mockResolvedValue({ data: mockResponse });
      (fromOrganizationRequestDTO as jest.Mock).mockReturnValue(mockResponse);

      await createOrg(mockFormData);

      expect(mockOrgStore.startLoading).toHaveBeenCalled();
      expect(axiosService.postData).toHaveBeenCalledWith(
        "/fhir/v1/organization",
        mockFormData
      );
      expect(mockOrgStore.upsertOrg).toHaveBeenCalledWith({
        ...mockResponse,
        _id: "org-1",
      });
      expect(mockOrgStore.setPrimaryOrg).toHaveBeenCalledWith("org-1");
      expect(mockOrgStore.upsertUserOrgMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          roleCode: "owner",
          organizationReference: "org-1",
        })
      );
    });

    it("handles 403 error", async () => {
      const error = new AxiosError("Forbidden", "403", undefined, {}, { status: 403 } as any);
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(createOrg(mockFormData)).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "You don't have permission to create organizations."
      );
    });

    it("handles 404 error", async () => {
      const error = new AxiosError("Not Found", "404", undefined, {}, { status: 404 } as any);
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(createOrg(mockFormData)).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "Organization service not found. Please contact support."
      );
    });

    it("handles non-axios error", async () => {
      const error = new Error("Unknown");
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(createOrg(mockFormData)).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "Unexpected error while creating organization"
      );
    });
  });

  // --- updateOrg Tests ---

  describe("updateOrg", () => {
    const mockFormData: any = { _id: "org-1", name: "Updated Org" };

    it("updates an organization successfully", async () => {
      const mockResponse = { _id: "org-1", name: "Updated Org" };
      (toOrganizationResponseDTO as jest.Mock).mockReturnValue(mockFormData);
      (axiosService.putData as jest.Mock).mockResolvedValue({ data: mockResponse });
      (fromOrganizationRequestDTO as jest.Mock).mockReturnValue(mockResponse);

      await updateOrg(mockFormData);

      expect(mockOrgStore.startLoading).toHaveBeenCalled();
      expect(axiosService.putData).toHaveBeenCalledWith(
        "/fhir/v1/organization/org-1",
        mockFormData
      );
      expect(mockOrgStore.updateOrg).toHaveBeenCalledWith("org-1", mockResponse);
    });

    it("returns error if _id is missing", async () => {
      const invalidData = { name: "No ID" };
      await updateOrg(invalidData as any);

      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "You don't have permission to update organizations."
      );
      expect(axiosService.putData).not.toHaveBeenCalled();
    });

    it("handles 403 error", async () => {
      const error = new AxiosError("Forbidden", "403", undefined, {}, { status: 403 } as any);
      (axiosService.putData as jest.Mock).mockRejectedValue(error);

      await expect(updateOrg(mockFormData)).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "You don't have permission to update organizations."
      );
    });

    it("handles 404 error", async () => {
      const error = new AxiosError("Not Found", "404", undefined, {}, { status: 404 } as any);
      (axiosService.putData as jest.Mock).mockRejectedValue(error);

      await expect(updateOrg(mockFormData)).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "Organization service not found. Please contact support."
      );
    });

    it("handles generic axios error", async () => {
       const error = new AxiosError("Generic", "500", undefined, {}, { status: 500, data: { message: "Fail" } } as any);
       (axiosService.putData as jest.Mock).mockRejectedValue(error);

       await expect(updateOrg(mockFormData)).rejects.toThrow(error);
       expect(mockOrgStore.setError).toHaveBeenCalledWith("Fail");
    });

    it("handles non-axios error", async () => {
      const error = new Error("Unknown");
      (axiosService.putData as jest.Mock).mockRejectedValue(error);

      await expect(updateOrg(mockFormData)).rejects.toThrow(error);
      expect(mockOrgStore.setError).toHaveBeenCalledWith(
        "Unexpected error while updating organization"
      );
    });
  });
});