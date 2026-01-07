import { getExploreMetrics } from "../../services/metricsService";
import { getData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { DashboardSummary, EMPTY_EXPLORE } from "../../types/metrics";

// --- Mocks ---

// 1. Mock Axios Helper
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;

// 2. Mock Store
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

describe("Metrics Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Validation (Missing Org) ---
  describe("getExploreMetrics - Validation", () => {
    it("returns EMPTY_EXPLORE and warns if no primaryOrgId is selected", async () => {
      // Setup store to return null
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await getExploreMetrics();

      expect(result).toEqual(EMPTY_EXPLORE);
      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot load companions.");
      expect(mockedGetData).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: Success Path ---
  describe("getExploreMetrics - Success", () => {
    it("fetches dashboard summary for the primary org", async () => {
      // Setup store with valid org
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: "org-123" });

      const mockSummary: DashboardSummary = {
        totalAppointments: 10,
        revenue: 5000,
        // ... other fields based on your type definition
      } as unknown as DashboardSummary;

      mockedGetData.mockResolvedValue({ data: mockSummary });

      const result = await getExploreMetrics();

      expect(mockedGetData).toHaveBeenCalledWith("/v1/dashboard/summary/org-123");
      expect(result).toEqual(mockSummary);
    });
  });

  // --- Section 3: Error Handling ---
  describe("getExploreMetrics - Error Handling", () => {
    it("logs error and rethrows when API fails", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: "org-123" });

      const error = new Error("Network Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(getExploreMetrics()).rejects.toThrow("Network Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });
});