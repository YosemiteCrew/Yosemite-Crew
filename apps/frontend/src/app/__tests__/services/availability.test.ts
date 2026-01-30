import {
  upsertAvailability,
  loadAvailability,
  getOveridesForPrimaryDate,
  createOveride,
  deleteOveride,
} from "../../services/availability";
import * as axiosService from "../../services/axios";
import { useAvailabilityStore } from "../../stores/availabilityStore";
import { useOrgStore } from "../../stores/orgStore";
import { ApiAvailability, ApiOverrides } from "../../components/Availability/utils";

// ----------------------------------------------------------------------------
// 1. Mocks
// ----------------------------------------------------------------------------

jest.mock("../../services/axios", () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  deleteData: jest.fn(),
}));

jest.mock("../../stores/availabilityStore", () => ({
  useAvailabilityStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

describe("Availability Service", () => {
  // Store Mocks
  const mockSetAvailabilitiesForOrg = jest.fn();
  const mockStartLoading = jest.fn();
  const mockSetAvailabilities = jest.fn();
  const mockUpsertOverideStore = jest.fn();
  const mockRemoveOverride = jest.fn();

  // Console Spy
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Console Spy to suppress/verify errors
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Default Store State
    (useAvailabilityStore.getState as jest.Mock).mockReturnValue({
      setAvailabilitiesForOrg: mockSetAvailabilitiesForOrg,
      startLoading: mockStartLoading,
      setAvailabilities: mockSetAvailabilities,
      upsertOverideStore: mockUpsertOverideStore,
      removeOverride: mockRemoveOverride,
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-1",
      orgIds: ["org-1", "org-2"],
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // 2. upsertAvailability Tests
  // --------------------------------------------------------------------------
  describe("upsertAvailability", () => {
    const mockFormData = { someField: "value" } as unknown as ApiAvailability;

    it("upserts successfully using orgIdFromQuery", async () => {
      const mockResponse = { data: { data: ["avail-1"] } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      await upsertAvailability(mockFormData, "query-org-id");

      expect(axiosService.postData).toHaveBeenCalledWith(
        "/fhir/v1/availability/query-org-id/base",
        mockFormData
      );
      expect(mockSetAvailabilitiesForOrg).toHaveBeenCalledWith("query-org-id", ["avail-1"]);
    });

    it("upserts successfully using primaryOrgId when query id is null", async () => {
      const mockResponse = { data: { data: ["avail-1"] } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      await upsertAvailability(mockFormData, null);

      expect(axiosService.postData).toHaveBeenCalledWith(
        "/fhir/v1/availability/org-1/base",
        mockFormData
      );
      expect(mockSetAvailabilitiesForOrg).toHaveBeenCalledWith("org-1", ["avail-1"]);
    });

    it("returns early if no org ID is available", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });

      await upsertAvailability(mockFormData, null);

      expect(axiosService.postData).not.toHaveBeenCalled();
      expect(mockSetAvailabilitiesForOrg).not.toHaveBeenCalled();
    });

    it("handles nullish response data gracefully", async () => {
      // res.data is undefined
      (axiosService.postData as jest.Mock).mockResolvedValue({});

      await upsertAvailability(mockFormData, "org-1");

      expect(mockSetAvailabilitiesForOrg).toHaveBeenCalledWith("org-1", []);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Upsert failed");
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(upsertAvailability(mockFormData, "org-1")).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load orgs:", error);
    });
  });

  // --------------------------------------------------------------------------
  // 3. loadAvailability Tests
  // --------------------------------------------------------------------------
  describe("loadAvailability", () => {
    it("starts loading if silent option is false/undefined", async () => {
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: { data: [] } });
      await loadAvailability();
      expect(mockStartLoading).toHaveBeenCalled();
    });

    it("does NOT start loading if silent option is true", async () => {
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: { data: [] } });
      await loadAvailability({ silent: true });
      expect(mockStartLoading).not.toHaveBeenCalled();
    });

    it("returns early if orgIds is empty", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ orgIds: [] });
      await loadAvailability();
      expect(axiosService.getData).not.toHaveBeenCalled();
      expect(mockSetAvailabilities).not.toHaveBeenCalled();
    });

    it("fetches and aggregates availability for multiple orgs", async () => {
      // Mock different responses for different orgs
      (axiosService.getData as jest.Mock)
        .mockResolvedValueOnce({ data: { data: ["a1"] } }) // org-1
        .mockResolvedValueOnce({ data: { data: ["a2"] } }); // org-2

      await loadAvailability();

      expect(axiosService.getData).toHaveBeenCalledTimes(2);
      expect(axiosService.getData).toHaveBeenCalledWith("/fhir/v1/availability/org-1/base");
      expect(axiosService.getData).toHaveBeenCalledWith("/fhir/v1/availability/org-2/base");

      // Order isn't guaranteed by Promise.allSettled but inputs are sequential
      expect(mockSetAvailabilities).toHaveBeenCalledWith(
        expect.arrayContaining(["a1", "a2"])
      );
    });

    it("handles individual fetch failures (inner try/catch)", async () => {
      (axiosService.getData as jest.Mock)
        .mockResolvedValueOnce({ data: { data: ["a1"] } }) // org-1 succeeds
        .mockRejectedValueOnce(new Error("Fetch failed")); // org-2 fails

      await loadAvailability();

      // Should still set availabilities for the successful ones
      expect(mockSetAvailabilities).toHaveBeenCalledWith(["a1"]);
      // Should log error for the failed one
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to fetch profile for orgId: org-2",
        expect.any(Error)
      );
    });

    it("handles nullish data in response", async () => {
        (axiosService.getData as jest.Mock).mockResolvedValue({ data: null });
        await loadAvailability();
        expect(mockSetAvailabilities).toHaveBeenCalledWith([]);
    });

    it("logs error and throws if outer logic fails", async () => {
      // Simulate error in setAvailabilities (outside the Promise.all logic)
      const error = new Error("Store error");
      mockSetAvailabilities.mockImplementation(() => { throw error; });
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: { data: [] } });

      await expect(loadAvailability()).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load orgs:", error);
    });
  });

  // --------------------------------------------------------------------------
  // 4. getOveridesForPrimaryDate Tests
  // --------------------------------------------------------------------------
  describe("getOveridesForPrimaryDate", () => {
    const mockDate = new Date("2023-10-01T00:00:00.000Z");

    it("fetches overrides successfully", async () => {
      const mockResponse = { data: { data: ["override-1"] } };
      (axiosService.getData as jest.Mock).mockResolvedValue(mockResponse);

      await getOveridesForPrimaryDate(mockDate);

      // normalDate = 2023-10-01
      expect(axiosService.getData).toHaveBeenCalledWith(
        "/fhir/v1/availability/org-1/weekly?weekStartDate=2023-10-01"
      );
      expect(mockUpsertOverideStore).toHaveBeenCalledWith(["override-1"]);
    });

    it("throws if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });

      await expect(getOveridesForPrimaryDate(mockDate)).rejects.toThrow(
        "No primary organization selected. Cannot load overides."
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to load overides:",
        expect.any(Error)
      );
    });

    it("handles nullish data response", async () => {
      (axiosService.getData as jest.Mock).mockResolvedValue({}); // no data.data

      await getOveridesForPrimaryDate(mockDate);

      expect(mockUpsertOverideStore).toHaveBeenCalledWith([]);
    });

    it("logs and throws on API error", async () => {
      const error = new Error("API fail");
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(getOveridesForPrimaryDate(mockDate)).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load overides:", error);
    });
  });

  // --------------------------------------------------------------------------
  // 5. createOveride Tests
  // --------------------------------------------------------------------------
  describe("createOveride", () => {
    const mockOverride = { _id: "ov-1" } as unknown as ApiOverrides;

    it("creates override successfully", async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({});

      await createOveride(mockOverride);

      expect(axiosService.postData).toHaveBeenCalledWith(
        "/fhir/v1/availability/org-1/weekly",
        mockOverride
      );
      expect(mockUpsertOverideStore).toHaveBeenCalledWith(mockOverride);
    });

    it("throws if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });

      await expect(createOveride(mockOverride)).rejects.toThrow(
        "No primary organization selected. Cannot create overides."
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to load overides:",
        expect.any(Error)
      );
    });

    it("logs and throws on API error", async () => {
      const error = new Error("Create fail");
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(createOveride(mockOverride)).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load overides:", error);
    });
  });

  // --------------------------------------------------------------------------
  // 6. deleteOveride Tests
  // --------------------------------------------------------------------------
  describe("deleteOveride", () => {
    const validOverride = {
      _id: "ov-1",
      dayOfWeek: "2023-10-01",
      organisationId: "org-1",
    } as unknown as ApiOverrides;

    it("deletes override successfully", async () => {
      (axiosService.deleteData as jest.Mock).mockResolvedValue({});

      await deleteOveride(validOverride);

      expect(axiosService.deleteData).toHaveBeenCalledWith(
        "/fhir/v1/availability/org-1/weekly?weekStartDate=2023-10-01"
      );
      expect(mockRemoveOverride).toHaveBeenCalledWith("ov-1");
    });

    // Fix: cast invalid objects to 'any' to bypass TS check but verify runtime validation logic
    it("throws if override ID is missing", async () => {
      const invalid = { ...validOverride, _id: undefined };
      await expect(deleteOveride(invalid as any)).rejects.toThrow("Cannot delete overides.");
    });

    it("throws if dayOfWeek is missing", async () => {
        const invalid = { ...validOverride, dayOfWeek: undefined };
        await expect(deleteOveride(invalid as any)).rejects.toThrow("Cannot delete overides.");
    });

    it("throws if organisationId is missing", async () => {
        const invalid = { ...validOverride, organisationId: undefined };
        await expect(deleteOveride(invalid as any)).rejects.toThrow("Cannot delete overides.");
    });

    it("logs and throws on API error", async () => {
      const error = new Error("Delete fail");
      (axiosService.deleteData as jest.Mock).mockRejectedValue(error);

      await expect(deleteOveride(validOverride)).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load overides:", error);
    });
  });
});