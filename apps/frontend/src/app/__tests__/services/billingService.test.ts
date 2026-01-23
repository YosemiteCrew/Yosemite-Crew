import {
  getStripeBillingPortal,
  getUpgradeLink,
} from "../../services/billingService";
import * as axiosService from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { BillingSubscriptionInterval } from "../../types/billing";

// ----------------------------------------------------------------------------
// 1. Mocks
// ----------------------------------------------------------------------------

jest.mock("../../services/axios", () => ({
  postData: jest.fn(),
}));

jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

describe("Billing Service", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // 2. getStripeBillingPortal Tests
  // --------------------------------------------------------------------------
  describe("getStripeBillingPortal", () => {
    it("fetches portal URL successfully", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({
        primaryOrgId: "org-1",
      });
      const mockResponse = { data: { url: "https://portal.stripe.com/123" } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      const url = await getStripeBillingPortal();

      expect(axiosService.postData).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-1/billing/portal"
      );
      expect(url).toBe("https://portal.stripe.com/123");
    });

    it("throws error if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({
        primaryOrgId: null,
      });

      await expect(getStripeBillingPortal()).rejects.toThrow(
        "No primary organization selected."
      );
      // Logic: It throws inside the try block, catches it, logs it, and rethrows it.
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create service:",
        expect.any(Error)
      );
    });

    it("logs and rethrows on API error", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({
        primaryOrgId: "org-1",
      });
      const error = new Error("Network Error");
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(getStripeBillingPortal()).rejects.toThrow("Network Error");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create service:",
        error
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. getUpgradeLink Tests
  // --------------------------------------------------------------------------
  describe("getUpgradeLink", () => {
    const validInterval: BillingSubscriptionInterval = "month";

    it("fetches upgrade checkout URL successfully", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({
        primaryOrgId: "org-1",
      });
      const mockResponse = { data: { url: "https://checkout.stripe.com/abc" } };
      (axiosService.postData as jest.Mock).mockResolvedValue(mockResponse);

      const url = await getUpgradeLink(validInterval);

      expect(axiosService.postData).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-1/billing/checkout",
        { interval: "month" }
      );
      expect(url).toBe("https://checkout.stripe.com/abc");
    });

    it("throws error if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({
        primaryOrgId: null,
      });

      await expect(getUpgradeLink(validInterval)).rejects.toThrow(
        "No primary organization selected."
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create service:",
        expect.any(Error)
      );
    });

    it("throws error if no interval is provided", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({
        primaryOrgId: "org-1",
      });

      // Cast undefined to any to bypass TS check and verify runtime validation
      await expect(getUpgradeLink(undefined as any)).rejects.toThrow(
        "No interval selected."
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create service:",
        expect.any(Error)
      );
    });

    it("logs and rethrows on API error", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({
        primaryOrgId: "org-1",
      });
      const error = new Error("API Failure");
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(getUpgradeLink(validInterval)).rejects.toThrow("API Failure");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create service:",
        error
      );
    });
  });
});