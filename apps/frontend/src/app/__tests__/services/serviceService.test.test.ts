import axios from "axios";
import { loadServicesForOrg } from "../../services/serviceService";
import { getData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { useServiceStore } from "../../stores/serviceStore";
import { fromServiceRequestDTO } from "@yosemite-crew/types";

// --- Mocks ---

// 1. Mock Axios Library (Fixed Hoisting Issue)
jest.mock("axios", () => {
  return {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    isAxiosError: jest.fn(),
  };
});

// 2. Mock Axios Service Helper
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;
const mockedIsAxiosError = axios.isAxiosError as unknown as jest.Mock;

// 3. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../stores/serviceStore", () => ({
  useServiceStore: {
    getState: jest.fn(),
  },
}));

// 4. Mock External Utils
jest.mock("@yosemite-crew/types", () => ({
  fromServiceRequestDTO: jest.fn(),
}));
const mockedFromDTO = fromServiceRequestDTO as jest.Mock;

describe("Service Service", () => {
  const mockServiceStoreSetServices = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Store State
    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-default",
    });

    (useServiceStore.getState as jest.Mock).mockReturnValue({
      setServices: mockServiceStoreSetServices,
    });
  });

  // --- Section 1: Validation & Early Exits ---
  describe("Validation", () => {
    it("returns empty array and warns if no orgId is provided or in store", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await loadServicesForOrg();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("No primary organisation selected. Skipping service fetch.");
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("fetches if orgId is explicitly provided even if store is empty", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      mockedGetData.mockResolvedValue({ data: [] });

      await loadServicesForOrg("org-explicit");

      expect(mockedGetData).toHaveBeenCalledWith("/fhir/v1/service/organisation/org-explicit");
    });
  });

  // --- Section 2: Success Path & Transformation ---
  describe("Success Path", () => {
    it("fetches, transforms, and updates store on successful response", async () => {
      const mockApiData = [{ id: "srv-raw-1", name: "Raw Service" }];
      const mockTransformedService = { id: "srv-1", name: "Transformed Service" };

      mockedGetData.mockResolvedValue({ data: mockApiData });
      mockedFromDTO.mockReturnValue(mockTransformedService);

      const result = await loadServicesForOrg("org-123");

      expect(mockedGetData).toHaveBeenCalledWith("/fhir/v1/service/organisation/org-123");

      // Verify transformation logic (index and array passed by map)
      expect(mockedFromDTO).toHaveBeenCalledWith(mockApiData[0], 0, mockApiData);

      expect(mockServiceStoreSetServices).toHaveBeenCalledWith([mockTransformedService]);
      expect(result).toEqual([mockTransformedService]);
    });
  });

  // --- Section 3: Data Integrity Checks ---
  describe("Data Integrity", () => {
    it("returns empty array and warns if response data is not an array", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      mockedGetData.mockResolvedValue({ data: { some: "object, not array" } });

      const result = await loadServicesForOrg("org-123");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Services response is not an array.", { some: "object, not array" });
      expect(mockServiceStoreSetServices).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: Error Handling ---
  describe("Error Handling", () => {
    it("handles generic errors safely", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Generic Error");
      mockedGetData.mockRejectedValue(error);
      mockedIsAxiosError.mockReturnValue(false);

      const result = await loadServicesForOrg("org-123");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load services:", error);
      consoleSpy.mockRestore();
    });

    it("handles Axios-specific errors with detailed messages", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const axiosError = {
        message: "Request failed",
        response: { data: { message: "Server Error 500" } },
        isAxiosError: true,
      };

      mockedGetData.mockRejectedValue(axiosError);
      mockedIsAxiosError.mockReturnValue(true);

      const result = await loadServicesForOrg("org-123");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load services:", "Server Error 500");
      consoleSpy.mockRestore();
    });

    it("handles Axios errors where response data message is missing", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const axiosError = {
        message: "Network Error",
        response: {},
        isAxiosError: true,
      };

      mockedGetData.mockRejectedValue(axiosError);
      mockedIsAxiosError.mockReturnValue(true);

      await loadServicesForOrg("org-123");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to load services:", "Network Error");
      consoleSpy.mockRestore();
    });
  });
});