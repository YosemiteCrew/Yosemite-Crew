import { prisma } from "src/config/prisma";

export class FinanceDiscountSettingsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FinanceDiscountSettingsError";
  }
}

export type OrganisationDiscountSettings = {
  organisationId: string;
  maxOverallDiscountPercent: number | null;
};

export const FinanceDiscountSettingsService = {
  /**
   * The organisation's maximum overall invoice discount percent, or null when
   * no cap is configured. Null is a real state: it means the overall discount
   * is not policy-limited for this organisation.
   */
  async getMaxOverallDiscountPercent(
    organisationId: string,
  ): Promise<number | null> {
    const organisation = await prisma.organization.findUnique({
      where: { id: organisationId },
      select: { maxOverallDiscountPercent: true },
    });

    return organisation?.maxOverallDiscountPercent ?? null;
  },

  async getForOrganisation(
    organisationId: string,
  ): Promise<OrganisationDiscountSettings> {
    const organisation = await prisma.organization.findUnique({
      where: { id: organisationId },
      select: { id: true, maxOverallDiscountPercent: true },
    });

    if (!organisation) {
      throw new FinanceDiscountSettingsError("Organisation not found.", 404);
    }

    return {
      organisationId: organisation.id,
      maxOverallDiscountPercent: organisation.maxOverallDiscountPercent ?? null,
    };
  },

  async updateForOrganisation(
    organisationId: string,
    input: { maxOverallDiscountPercent: number | null },
  ): Promise<OrganisationDiscountSettings> {
    const existing = await prisma.organization.findUnique({
      where: { id: organisationId },
      select: { id: true },
    });

    if (!existing) {
      throw new FinanceDiscountSettingsError("Organisation not found.", 404);
    }

    const organisation = await prisma.organization.update({
      where: { id: organisationId },
      data: { maxOverallDiscountPercent: input.maxOverallDiscountPercent },
      select: { id: true, maxOverallDiscountPercent: true },
    });

    return {
      organisationId: organisation.id,
      maxOverallDiscountPercent: organisation.maxOverallDiscountPercent ?? null,
    };
  },
};
