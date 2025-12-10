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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rateOrganisation", () => {
    it("upserts a rating and recalculates aggregates", async () => {
      const recalcSpy = jest
        .spyOn(OrganizationRatingService, "recalculateAverageRating")
        .mockResolvedValueOnce();

      const result = await OrganizationRatingService.rateOrganisation(
        "org-1",
        "user-1",
        5,
        "great",
      );

      expect(mockedRatingModel.findOneAndUpdate).toHaveBeenCalledWith(
        { organizationId: "org-1", userId: "user-1" },
        { rating: 5, review: "great" },
        { upsert: true, new: true },
      );
      expect(recalcSpy).toHaveBeenCalledWith("org-1");
      expect(result).toEqual({ success: true });
    });
  });

  describe("recalculateAverageRating", () => {
    it("updates organisation with averaged stats when ratings exist", async () => {
      mockedRatingModel.aggregate.mockResolvedValueOnce([
        { _id: "org-1", averageRating: 4.33, ratingCount: 3 },
      ]);

      await OrganizationRatingService.recalculateAverageRating("org-1");

      expect(mockedOrgModel.findByIdAndUpdate).toHaveBeenCalledWith("org-1", {
        averageRating: "4.3",
        ratingCount: 3,
      });
    });

    it("resets organisation stats when no ratings found", async () => {
      mockedRatingModel.aggregate.mockResolvedValueOnce([]);

      await OrganizationRatingService.recalculateAverageRating("org-2");

      expect(mockedOrgModel.findByIdAndUpdate).toHaveBeenCalledWith("org-2", {
        averageRating: 0,
        ratingCount: 0,
      });
    });
  });
});
