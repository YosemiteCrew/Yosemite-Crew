import { OrganizationRatingService } from "src/services/organisationReting.service";
import { OrganisationRatingModel } from "src/models/organisationRating";
import OrganizationModel from "src/models/organization";

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

const mockedRatingModel = OrganisationRatingModel as unknown as {
  findOneAndUpdate: jest.Mock;
  aggregate: jest.Mock;
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
        { upsert: true, new: true },
      );
      expect(recalcSpy).toHaveBeenCalledWith(orgId);
      expect(result).toEqual({ success: true });
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
  });
});
