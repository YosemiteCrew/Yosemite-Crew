import {
  getStripeBillingPortal,
  getUpgradeLink,
  getCheckoutClientSecret,
} from "@/app/features/billing/services/billingService";

const postDataMock = jest.fn();

jest.mock("@/app/services/axios", () => ({
  postData: (...args: any[]) => postDataMock(...args),
}));

const mockOrgState = {
  primaryOrgId: "org-123",
};

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: {
    getState: () => mockOrgState,
  },
}));

describe("billingService", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrgState.primaryOrgId = "org-123";
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("getStripeBillingPortal", () => {
    it("posts to billing portal endpoint and returns URL", async () => {
      postDataMock.mockResolvedValue({
        data: { url: "https://billing.stripe.com/portal" },
      });

      const result = await getStripeBillingPortal();

      expect(postDataMock).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-123/billing/portal"
      );
      expect(result).toBe("https://billing.stripe.com/portal");
    });

    it("throws error when no primary org selected", async () => {
      mockOrgState.primaryOrgId = "";

      await expect(getStripeBillingPortal()).rejects.toThrow(
        "No primary organization selected."
      );
    });

    it("throws error when API call fails", async () => {
      postDataMock.mockRejectedValue(new Error("API error"));

      await expect(getStripeBillingPortal()).rejects.toThrow("API error");
    });
  });

  describe("getUpgradeLink", () => {
    it("posts to checkout endpoint with month interval", async () => {
      postDataMock.mockResolvedValue({
        data: { url: "https://checkout.stripe.com/upgrade" },
      });

      const result = await getUpgradeLink("month");

      expect(postDataMock).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-123/billing/checkout",
        { interval: "month" }
      );
      expect(result).toBe("https://checkout.stripe.com/upgrade");
    });

    it("posts to checkout endpoint with year interval", async () => {
      postDataMock.mockResolvedValue({
        data: { url: "https://checkout.stripe.com/upgrade-year" },
      });

      const result = await getUpgradeLink("year");

      expect(postDataMock).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-123/billing/checkout",
        { interval: "year" }
      );
      expect(result).toBe("https://checkout.stripe.com/upgrade-year");
    });

    it("throws error when no primary org selected", async () => {
      mockOrgState.primaryOrgId = "";

      await expect(getUpgradeLink("month")).rejects.toThrow(
        "No primary organization selected."
      );
    });

    it("throws error when no interval provided", async () => {
      await expect(getUpgradeLink("" as any)).rejects.toThrow(
        "No interval selected."
      );
    });

    it("throws error when API call fails", async () => {
      postDataMock.mockRejectedValue(new Error("API error"));

      await expect(getUpgradeLink("month")).rejects.toThrow("API error");
    });
  });

  describe("getCheckoutClientSecret", () => {
    it("posts to checkout endpoint and returns client secret", async () => {
      postDataMock.mockResolvedValue({
        data: { clientSecret: "cs_test_123" },
      });

      const result = await getCheckoutClientSecret("month");

      expect(postDataMock).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-123/billing/checkout",
        { interval: "month" }
      );
      expect(result).toBe("cs_test_123");
    });

    it("throws error when no primary org selected", async () => {
      mockOrgState.primaryOrgId = "";

      await expect(getCheckoutClientSecret("month")).rejects.toThrow(
        "No primary organization selected."
      );
    });

    it("throws error when no interval provided", async () => {
      await expect(getCheckoutClientSecret("" as any)).rejects.toThrow(
        "No interval selected."
      );
    });

    it("throws error when no clientSecret returned", async () => {
      postDataMock.mockResolvedValue({
        data: {},
      });

      await expect(getCheckoutClientSecret("month")).rejects.toThrow(
        "No clientSecret returned from backend."
      );
    });
  });
});
