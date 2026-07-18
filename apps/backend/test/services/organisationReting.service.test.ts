import { OrganizationRatingService } from "src/services/organisationReting.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organisationRating: {
      upsert: jest.fn(),
      aggregate: jest.fn(),
      findFirst: jest.fn(),
    },
    organization: {
      updateMany: jest.fn(),
    },
  },
}));

describe("OrganizationRatingService", () => {
  const orgId = "507f1f77bcf86cd799439021";
  const otherOrgId = "507f1f77bcf86cd799439022";
  const userId = "507f1f77bcf86cd799439023";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rateOrganisation", () => {
    it("upserts a rating and recalculates aggregates", async () => {
      const recalcSpy = jest
        .spyOn(OrganizationRatingService, "recalculateAverageRating")
        .mockResolvedValueOnce();

      const result = await OrganizationRatingService.rateOrganisation(
        orgId,
        userId,
        5,
        "great",
      );

      expect(prisma.organisationRating.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_userId: {
              organizationId: orgId,
              userId,
            },
          },
          create: {
            organizationId: orgId,
            userId,
            rating: 5,
            review: "great",
          },
          update: {
            rating: 5,
            review: "great",
          },
        }),
      );
      expect(recalcSpy).toHaveBeenCalledWith(orgId);
      expect(result).toEqual({ success: true });

      recalcSpy.mockRestore();
    });

    it("throws on an empty organizationId", async () => {
      await expect(
        OrganizationRatingService.rateOrganisation("", userId, 5),
      ).rejects.toThrow("Invalid organizationId");
    });

    it("throws on an empty userId", async () => {
      await expect(
        OrganizationRatingService.rateOrganisation(orgId, "", 5),
      ).rejects.toThrow("Invalid userId");
    });
  });

  describe("recalculateAverageRating", () => {
    it("updates organisation with averaged stats when ratings exist", async () => {
      (prisma.organisationRating.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: 4.26 },
        _count: { rating: 5 },
      });

      await OrganizationRatingService.recalculateAverageRating(orgId);

      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { OR: [{ id: orgId }, { fhirId: orgId }] },
        data: { averageRating: 4.3, ratingCount: 5 },
      });
    });

    it("resets organisation stats when no ratings found", async () => {
      (prisma.organisationRating.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });

      await OrganizationRatingService.recalculateAverageRating(otherOrgId);

      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { OR: [{ id: otherOrgId }, { fhirId: otherOrgId }] },
        data: { averageRating: 0, ratingCount: 0 },
      });
    });
  });

  describe("isUserRatedOrganisation", () => {
    it("returns the rating when one exists", async () => {
      (prisma.organisationRating.findFirst as jest.Mock).mockResolvedValue({
        rating: 3,
        review: null,
      });

      const res = await OrganizationRatingService.isUserRatedOrganisation(
        orgId,
        userId,
      );

      expect(res).toEqual({ isRated: true, rating: 3, review: null });
    });

    it("returns not rated when no rating exists", async () => {
      (prisma.organisationRating.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const res = await OrganizationRatingService.isUserRatedOrganisation(
        orgId,
        userId,
      );

      expect(res).toEqual({ isRated: false, rating: null, review: null });
    });
  });
});
