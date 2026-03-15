import { OrganizationRatingService } from "src/services/organisationReting.service";
import { OrganisationRatingModel } from "src/models/organisationRating";
import OrganizationModel from "src/models/organization";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

jest.mock("src/models/organisationRating", () => ({
  __esModule: true,
  OrganisationRatingModel: {
    findOneAndUpdate: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock("src/models/organization", () => ({
  __esModule: true,
  default: {
    findByIdAndUpdate: jest.fn(),
  },
}));

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

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

const mockedRatingModel = OrganisationRatingModel as unknown as {
  findOneAndUpdate: jest.Mock;
  aggregate: jest.Mock;
  findOne?: jest.Mock;
};

const mockedOrgModel = OrganizationModel as unknown as {
  findByIdAndUpdate: jest.Mock;
};

describe("OrganizationRatingService", () => {
  const orgId = "507f1f77bcf86cd799439021";
  const otherOrgId = "507f1f77bcf86cd799439022";
  const userId = "507f1f77bcf86cd799439023";
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
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

      expect(mockedRatingModel.findOneAndUpdate).toHaveBeenCalledWith(
        { organizationId: orgId, userId: userId },
        { rating: 5, review: "great" },
        { upsert: true, new: true, sanitizeFilter: true },
      );
      expect(recalcSpy).toHaveBeenCalledWith(orgId);
      expect(result).toEqual({ success: true });
    });

    it("uses postgres upsert when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      const recalcSpy = jest
        .spyOn(OrganizationRatingService, "recalculateAverageRating")
        .mockResolvedValueOnce();

      const result = await OrganizationRatingService.rateOrganisation(
        "org-1",
        "user-1",
        4,
      );

      expect(prisma.organisationRating.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_userId: {
              organizationId: "org-1",
              userId: "user-1",
            },
          },
        }),
      );
      expect(recalcSpy).toHaveBeenCalledWith("org-1");
      expect(result).toEqual({ success: true });
    });

    it("throws on invalid ids in mongo mode", async () => {
      await expect(
        OrganizationRatingService.rateOrganisation("bad-id", userId, 5),
      ).rejects.toThrow("Invalid organizationId");
      await expect(
        OrganizationRatingService.rateOrganisation(orgId, "bad-id", 5),
      ).rejects.toThrow("Invalid userId");
    });

    it("handles dual-write errors for mongo upsert", async () => {
      (mockedRatingModel.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: { toString: () => "rating-1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.organisationRating.upsert as jest.Mock).mockRejectedValue(
        new Error("dual write fail"),
      );
      jest
        .spyOn(OrganizationRatingService, "recalculateAverageRating")
        .mockResolvedValueOnce();

      await OrganizationRatingService.rateOrganisation(orgId, userId, 4);

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "OrganisationRating",
        expect.any(Error),
      );
    });
  });

  describe("recalculateAverageRating", () => {
    it("updates organisation with averaged stats when ratings exist", async () => {
      mockedRatingModel.aggregate.mockResolvedValueOnce([
        { _id: orgId, averageRating: 4.33, ratingCount: 3 },
      ]);

      await OrganizationRatingService.recalculateAverageRating(orgId);

      expect(mockedOrgModel.findByIdAndUpdate).toHaveBeenCalledWith(orgId, {
        averageRating: "4.3",
        ratingCount: 3,
      });
    });

    it("resets organisation stats when no ratings found", async () => {
      mockedRatingModel.aggregate.mockResolvedValueOnce([]);

      await OrganizationRatingService.recalculateAverageRating(otherOrgId);

      expect(mockedOrgModel.findByIdAndUpdate).toHaveBeenCalledWith(
        otherOrgId,
        {
          averageRating: 0,
          ratingCount: 0,
        },
      );
    });

    it("updates postgres aggregates when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.organisationRating.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: 4.26 },
        _count: { rating: 5 },
      });

      await OrganizationRatingService.recalculateAverageRating("org-1");

      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: { averageRating: 4.3, ratingCount: 5 },
      });
    });

    it("handles dual-write error when updating averages", async () => {
      mockedRatingModel.aggregate.mockResolvedValueOnce([
        { _id: orgId, averageRating: 4.9, ratingCount: 2 },
      ]);
      (prisma.organization.updateMany as jest.Mock).mockRejectedValue(
        new Error("update fail"),
      );

      await OrganizationRatingService.recalculateAverageRating(orgId);

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "Organization rating update",
        expect.any(Error),
      );
    });

    it("handles dual-write error when resetting averages", async () => {
      mockedRatingModel.aggregate.mockResolvedValueOnce([]);
      (prisma.organization.updateMany as jest.Mock).mockRejectedValue(
        new Error("reset fail"),
      );

      await OrganizationRatingService.recalculateAverageRating(orgId);

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "Organization rating reset",
        expect.any(Error),
      );
    });
  });

  describe("isUserRatedOrganisation", () => {
    it("returns rating when found in mongo", async () => {
      (OrganisationRatingModel as any).findOne = jest
        .fn()
        .mockResolvedValue({ rating: 5, review: "nice" });

      const res = await OrganizationRatingService.isUserRatedOrganisation(
        orgId,
        userId,
      );

      expect(res).toEqual({ isRated: true, rating: 5, review: "nice" });
    });

    it("returns rating when found in postgres", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.organisationRating.findFirst as jest.Mock).mockResolvedValue({
        rating: 3,
        review: null,
      });

      const res = await OrganizationRatingService.isUserRatedOrganisation(
        "org-1",
        "user-1",
      );

      expect(res).toEqual({ isRated: true, rating: 3, review: null });
    });
  });
});
