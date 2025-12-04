import { OrganisationRatingModel } from "../models/organisationRating";
import OrganizationModel from "../models/organization";

export const OrganizationRatingService = {
  async rateOrganisation(
    organizationId: string,
    userId: string,
    rating: number,
    review?: string,
  ) {
    // Upsert user rating
    await OrganisationRatingModel.findOneAndUpdate(
      { organizationId, userId },
      { rating, review },
      { upsert: true, new: true },
    );

    // Recalculate average rating
    await this.recalculateAverageRating(organizationId);

    return { success: true };
  },

  async recalculateAverageRating(orgId: string) {
    const stats = await OrganisationRatingModel.aggregate<{
      _id: string;
      averageRating: number;
      ratingCount: number;
    }>([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: "$organizationId",
          averageRating: { $avg: "$rating" },
          ratingCount: { $sum: 1 },
        },
      },
    ]);

    if (stats.length) {
      const { averageRating, ratingCount } = stats[0];
      await OrganizationModel.findByIdAndUpdate(orgId, {
        averageRating: averageRating.toFixed(1),
        ratingCount,
      });
    } else {
      // No ratings — reset values
      await OrganizationModel.findByIdAndUpdate(orgId, {
        averageRating: 0,
        ratingCount: 0,
      });
    }
  },

  async isUserRatedOrganisation(organisationId: string, userId: string) {
    const existingRating = await OrganisationRatingModel.findOne({
      organizationId: organisationId,
      userId,
    });
    return {
      isRated: existingRating ? true : false,
      rating: existingRating ? existingRating.rating : null,
      review: existingRating ? existingRating.review : null,
    }
  },
};
