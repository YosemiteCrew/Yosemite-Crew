import { Types } from "mongoose";
import { OrganisationRatingModel } from "../models/organisationRating";
import OrganizationModel from "../models/organization";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";

const ensureObjectId = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
};

export const OrganizationRatingService = {
  async rateOrganisation(
    organizationId: string,
    userId: string,
    rating: number,
    review?: string,
  ) {
    const safeOrganizationId = ensureObjectId(organizationId, "organizationId");
    const safeUserId = ensureObjectId(userId, "userId");
    // Upsert user rating
    const ratingDoc = await OrganisationRatingModel.findOneAndUpdate(
      { organizationId: safeOrganizationId, userId: safeUserId },
      { rating, review },
      { upsert: true, new: true },
    );

    if (ratingDoc && shouldDualWrite) {
      try {
        await prisma.organisationRating.upsert({
          where: {
            organizationId_userId: {
              organizationId: safeOrganizationId,
              userId: safeUserId,
            },
          },
          create: {
            id: ratingDoc._id.toString(),
            organizationId: safeOrganizationId,
            userId: safeUserId,
            rating,
            review: review ?? undefined,
            createdAt: ratingDoc.createdAt ?? undefined,
            updatedAt: ratingDoc.updatedAt ?? undefined,
          },
          update: {
            rating,
            review: review ?? undefined,
            updatedAt: ratingDoc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganisationRating", err);
      }
    }

    // Recalculate average rating
    await this.recalculateAverageRating(safeOrganizationId);

    return { success: true };
  },

  async recalculateAverageRating(orgId: string) {
    const safeOrgId = ensureObjectId(orgId, "organizationId");
    const stats = await OrganisationRatingModel.aggregate<{
      _id: string;
      averageRating: number;
      ratingCount: number;
    }>([
      { $match: { organizationId: safeOrgId } },
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
      await OrganizationModel.findByIdAndUpdate(safeOrgId, {
        averageRating: averageRating.toFixed(1),
        ratingCount,
      });

      if (shouldDualWrite) {
        try {
          await prisma.organization.updateMany({
            where: { id: safeOrgId },
            data: {
              averageRating: Number(averageRating.toFixed(1)),
              ratingCount,
            },
          });
        } catch (err) {
          handleDualWriteError("Organization rating update", err);
        }
      }
    } else {
      // No ratings — reset values
      await OrganizationModel.findByIdAndUpdate(safeOrgId, {
        averageRating: 0,
        ratingCount: 0,
      });

      if (shouldDualWrite) {
        try {
          await prisma.organization.updateMany({
            where: { id: safeOrgId },
            data: {
              averageRating: 0,
              ratingCount: 0,
            },
          });
        } catch (err) {
          handleDualWriteError("Organization rating reset", err);
        }
      }
    }
  },

  async isUserRatedOrganisation(organisationId: string, userId: string) {
    const safeOrganisationId = ensureObjectId(organisationId, "organisationId");
    const safeUserId = ensureObjectId(userId, "userId");
    const existingRating = await OrganisationRatingModel.findOne({
      organizationId: safeOrganisationId,
      userId: safeUserId,
    });
    return {
      isRated: !!existingRating,
      rating: existingRating ? existingRating.rating : null,
      review: existingRating ? existingRating.review : null,
    };
  },
};
