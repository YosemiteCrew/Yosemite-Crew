import { DeveloperUsageService } from "../../src/services/developer-usage.service";
import { DeveloperBillingService } from "../../src/services/developer-billing.service";
import { prisma } from "../../src/config/prisma";
import logger from "../../src/utils/logger";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerApiUsage: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    developerSubscription: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/developer-billing.service", () => ({
  DeveloperBillingService: {
    reportUsage: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  developerApiUsage: {
    upsert: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
  };
  developerSubscription: {
    findUnique: jest.Mock;
  };
};

const mockReportUsage = DeveloperBillingService.reportUsage as jest.Mock;
const mockLoggerError = logger.error as jest.Mock;

describe("DeveloperUsageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("incrementAndCheck", () => {
    it("free plan, first call — returns allowed:true and callCount:1", async () => {
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({ callCount: 1 });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "free",
        stripeCustomerId: null,
      });

      const result = await DeveloperUsageService.incrementAndCheck("org-1");

      expect(result).toEqual({ allowed: true, callCount: 1 });
      expect(mockReportUsage).not.toHaveBeenCalled();
    });

    it("free plan, 1001st call — returns allowed:false", async () => {
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({
        callCount: 1001,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "free",
        stripeCustomerId: null,
      });

      const result = await DeveloperUsageService.incrementAndCheck("org-1");

      expect(result).toEqual({ allowed: false, callCount: 1001 });
    });

    it("free plan at exactly 1000 — returns allowed:true (boundary is non-inclusive)", async () => {
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({
        callCount: 1000,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "free",
        stripeCustomerId: null,
      });

      const result = await DeveloperUsageService.incrementAndCheck("org-1");

      expect(result).toEqual({ allowed: true, callCount: 1000 });
    });

    it("pro plan — returns allowed:true and fires reportToStripe for Stripe", async () => {
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({ callCount: 42 });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "pro",
        stripeCustomerId: "cus_x",
      });
      mockReportUsage.mockResolvedValue(undefined);
      mockPrisma.developerApiUsage.update.mockResolvedValue({});

      const result = await DeveloperUsageService.incrementAndCheck("org-1");

      expect(result).toEqual({ allowed: true, callCount: 42 });

      // Flush the void IIFE inside reportToStripe
      await Promise.resolve();
      await Promise.resolve();

      expect(mockReportUsage).toHaveBeenCalledWith("cus_x", 42);
    });

    it("no subscription record (null) — defaults to free plan, allowed:true when count <= 1000", async () => {
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({ callCount: 5 });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue(null);

      const result = await DeveloperUsageService.incrementAndCheck("org-1");

      expect(result).toEqual({ allowed: true, callCount: 5 });
      expect(mockReportUsage).not.toHaveBeenCalled();
    });

    it("pro plan with null stripeCustomerId — does NOT call reportUsage", async () => {
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({ callCount: 10 });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "pro",
        stripeCustomerId: null,
      });

      const result = await DeveloperUsageService.incrementAndCheck("org-1");

      expect(result).toEqual({ allowed: true, callCount: 10 });

      await Promise.resolve();
      await Promise.resolve();

      expect(mockReportUsage).not.toHaveBeenCalled();
    });
  });

  describe("reportToStripe", () => {
    it("happy path — calls reportUsage then updates lastReportedAt", async () => {
      mockReportUsage.mockResolvedValue(undefined);
      mockPrisma.developerApiUsage.update.mockResolvedValue({});

      DeveloperUsageService.reportToStripe("cus_abc", "org-1", "2026-06", 99);

      // Wait for the void IIFE to settle
      await Promise.resolve();
      await Promise.resolve();

      expect(mockReportUsage).toHaveBeenCalledWith("cus_abc", 99);
      expect(mockPrisma.developerApiUsage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId_billingPeriod: {
              organisationId: "org-1",
              billingPeriod: "2026-06",
            },
          },
          data: expect.objectContaining({ lastReportedAt: expect.any(Date) }),
        }),
      );
    });

    it("reportUsage throws — logs the error, does not rethrow", async () => {
      const boom = new Error("stripe down");
      mockReportUsage.mockRejectedValue(boom);

      // Should not throw from the caller's perspective
      expect(() => {
        DeveloperUsageService.reportToStripe("cus_abc", "org-1", "2026-06", 5);
      }).not.toThrow();

      // Flush the void IIFE
      await Promise.resolve();
      await Promise.resolve();

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to report API usage to Stripe",
        expect.objectContaining({
          organisationId: "org-1",
          billingPeriod: "2026-06",
          err: boom,
        }),
      );
      // update should NOT have been called after the throw
      expect(mockPrisma.developerApiUsage.update).not.toHaveBeenCalled();
    });
  });

  describe("getUsage", () => {
    it("free plan — returns billingPeriod, callCount, and limit:1000", async () => {
      mockPrisma.developerApiUsage.findUnique.mockResolvedValue({
        callCount: 77,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "free",
      });

      const result = await DeveloperUsageService.getUsage("org-1", "2026-06");

      expect(result).toEqual({
        billingPeriod: "2026-06",
        callCount: 77,
        limit: 1000,
      });
    });

    it("pro plan — returns limit:null", async () => {
      mockPrisma.developerApiUsage.findUnique.mockResolvedValue({
        callCount: 500,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "pro",
      });

      const result = await DeveloperUsageService.getUsage("org-1", "2026-06");

      expect(result).toEqual({
        billingPeriod: "2026-06",
        callCount: 500,
        limit: null,
      });
    });

    it("no usage record — returns callCount:0", async () => {
      mockPrisma.developerApiUsage.findUnique.mockResolvedValue(null);
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "free",
      });

      const result = await DeveloperUsageService.getUsage("org-1", "2026-06");

      expect(result).toEqual({
        billingPeriod: "2026-06",
        callCount: 0,
        limit: 1000,
      });
    });

    it("uses current billing period when none is provided", async () => {
      mockPrisma.developerApiUsage.findUnique.mockResolvedValue({
        callCount: 3,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "free",
      });

      const result = await DeveloperUsageService.getUsage("org-1");

      expect(result.callCount).toBe(3);
      expect(result.billingPeriod).toMatch(/^\d{4}-\d{2}$/);
    });

    it("defaults to free when no subscription record exists", async () => {
      mockPrisma.developerApiUsage.findUnique.mockResolvedValue({
        callCount: 5,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue(null);

      const result = await DeveloperUsageService.getUsage("org-1", "2026-06");

      expect(result.limit).toBe(1000);
    });
  });
});
