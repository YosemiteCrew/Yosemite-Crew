import { getExploreMetrics } from "@/app/features/metrics/services/metricsService";
import { http } from "@/app/services/http";
import { useOrgStore } from "@/app/stores/orgStore";
import { logger } from "@/app/lib/logger";
import { DashboardSummary, EMPTY_EXPLORE } from "@/app/features/metrics/types/metrics";

// --- Mocks ---

// 1. Mock HTTP client
jest.mock("@/app/services/http", () => ({
  http: {
    get: jest.fn(),
  },
}));
const mockedGet = http.get as jest.Mock;

// 2. Mock Logger
jest.mock("@/app/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
const mockedLogger = logger as jest.Mocked<typeof logger>;

// 3. Mock Store
jest.mock("@/app/stores/orgStore", () => ({
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
      const result = await getExploreMetrics();

      expect(result).toEqual(EMPTY_EXPLORE);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load companions."
      );
      expect(mockedGet).not.toHaveBeenCalled();
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

      mockedGet.mockResolvedValue({ data: mockSummary });

      const result = await getExploreMetrics();

      expect(mockedGet).toHaveBeenCalledWith("/v1/dashboard/summary/org-123");
      expect(result).toEqual(mockSummary);
    });
  });

  // --- Section 3: Error Handling ---
  describe("getExploreMetrics - Error Handling", () => {
    it("logs error and rethrows when API fails", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: "org-123" });

      const error = new Error("Network Error");
      mockedGet.mockRejectedValue(error);

      await expect(getExploreMetrics()).rejects.toThrow("Network Error");

      expect(mockedLogger.error).toHaveBeenCalledWith("Failed to load metrics:", error);
    });
  });
});
