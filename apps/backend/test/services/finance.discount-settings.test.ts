import {
  FinanceDiscountSettingsError,
  FinanceDiscountSettingsService,
} from "../../src/services/finance/discount-settings";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("FinanceDiscountSettingsService", () => {
  const organisationId = "org_1";

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("getMaxOverallDiscountPercent", () => {
    it("returns the configured cap", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        maxOverallDiscountPercent: 25,
      });

      await expect(
        FinanceDiscountSettingsService.getMaxOverallDiscountPercent(
          organisationId,
        ),
      ).resolves.toBe(25);
    });

    it("returns null when no cap is configured", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        maxOverallDiscountPercent: null,
      });

      await expect(
        FinanceDiscountSettingsService.getMaxOverallDiscountPercent(
          organisationId,
        ),
      ).resolves.toBeNull();
    });

    it("returns null when the organisation is missing", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        FinanceDiscountSettingsService.getMaxOverallDiscountPercent(
          organisationId,
        ),
      ).resolves.toBeNull();
    });

    it("treats a zero cap as configured, not as absent", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        maxOverallDiscountPercent: 0,
      });

      await expect(
        FinanceDiscountSettingsService.getMaxOverallDiscountPercent(
          organisationId,
        ),
      ).resolves.toBe(0);
    });
  });

  describe("getForOrganisation", () => {
    it("returns the organisation's settings", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: organisationId,
        maxOverallDiscountPercent: 15,
      });

      await expect(
        FinanceDiscountSettingsService.getForOrganisation(organisationId),
      ).resolves.toEqual({ organisationId, maxOverallDiscountPercent: 15 });
    });

    it("reports a null cap as an unconfigured cap", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: organisationId,
        maxOverallDiscountPercent: null,
      });

      await expect(
        FinanceDiscountSettingsService.getForOrganisation(organisationId),
      ).resolves.toEqual({ organisationId, maxOverallDiscountPercent: null });
    });

    it("throws a 404 when the organisation does not exist", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        FinanceDiscountSettingsService.getForOrganisation(organisationId),
      ).rejects.toThrow(FinanceDiscountSettingsError);
      await expect(
        FinanceDiscountSettingsService.getForOrganisation(organisationId),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("updateForOrganisation", () => {
    it("persists a new cap", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: organisationId,
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue({
        id: organisationId,
        maxOverallDiscountPercent: 30,
      });

      await expect(
        FinanceDiscountSettingsService.updateForOrganisation(organisationId, {
          maxOverallDiscountPercent: 30,
        }),
      ).resolves.toEqual({ organisationId, maxOverallDiscountPercent: 30 });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: organisationId },
        data: { maxOverallDiscountPercent: 30 },
        select: { id: true, maxOverallDiscountPercent: true },
      });
    });

    it("clears the cap when given null", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: organisationId,
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue({
        id: organisationId,
        maxOverallDiscountPercent: null,
      });

      await expect(
        FinanceDiscountSettingsService.updateForOrganisation(organisationId, {
          maxOverallDiscountPercent: null,
        }),
      ).resolves.toEqual({ organisationId, maxOverallDiscountPercent: null });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: organisationId },
        data: { maxOverallDiscountPercent: null },
        select: { id: true, maxOverallDiscountPercent: true },
      });
    });

    it("throws a 404 without writing when the organisation does not exist", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        FinanceDiscountSettingsService.updateForOrganisation(organisationId, {
          maxOverallDiscountPercent: 30,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });
  });
});
