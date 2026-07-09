import { prisma } from "src/config/prisma";

const ensureObjectId = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
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

    await prisma.organisationRating.upsert({
      where: {
        organizationId_userId: {
          organizationId: safeOrganizationId,
          userId: safeUserId,
        },
      },
      create: {
        organizationId: safeOrganizationId,
        userId: safeUserId,
        rating,
        review: review ?? undefined,
      },
      update: {
        rating,
        review: review ?? undefined,
      },
    });

    await this.recalculateAverageRating(safeOrganizationId);
    return { success: true };
  },

  async recalculateAverageRating(orgId: string) {
    const safeOrgId = ensureObjectId(orgId, "organizationId");

    const stats = await prisma.organisationRating.aggregate({
      where: { organizationId: safeOrgId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const averageRating = stats._avg.rating ?? 0;
    const ratingCount = stats._count.rating ?? 0;

    await prisma.organization.updateMany({
      where: { id: safeOrgId },
      data: {
        averageRating: ratingCount ? Number(averageRating.toFixed(1)) : 0,
        ratingCount,
      },
    });
  },

  async isUserRatedOrganisation(organisationId: string, userId: string) {
    const safeOrganisationId = ensureObjectId(organisationId, "organisationId");
    const safeUserId = ensureObjectId(userId, "userId");

    const existingRating = await prisma.organisationRating.findFirst({
      where: { organizationId: safeOrganisationId, userId: safeUserId },
    });

    return {
      isRated: !!existingRating,
      rating: existingRating ? existingRating.rating : null,
      review: existingRating ? existingRating.review : null,
    };
  },
};
