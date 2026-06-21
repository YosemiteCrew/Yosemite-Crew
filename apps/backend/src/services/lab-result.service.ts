import { prisma } from "src/config/prisma";

export class LabResultServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "LabResultServiceError";
  }
}

export const LabResultService = {
  async list(params: {
    organisationId?: string;
    provider?: string;
    orderId?: string;
    patientId?: string;
    limit?: number;
  }) {
    const safeOrganisationId =
      typeof params.organisationId === "string" && params.organisationId.trim()
        ? params.organisationId
        : undefined;
    const safeProvider =
      typeof params.provider === "string" && params.provider.trim()
        ? params.provider
        : undefined;
    const safeOrderId =
      typeof params.orderId === "string" && params.orderId.trim()
        ? params.orderId
        : undefined;
    const safeLimit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.floor(params.limit)
        : undefined;

    const where: Record<string, unknown> = {};
    if (safeOrganisationId) where.organisationId = safeOrganisationId;
    if (safeProvider) where.provider = safeProvider;
    if (safeOrderId) where.orderId = safeOrderId;
    if (params.patientId) {
      if (!params.patientId.trim()) {
        throw new LabResultServiceError("Invalid patientId", 400);
      }
      const orders = await prisma.labOrder.findMany({
        where: { patientId: params.patientId },
        select: { idexxOrderId: true },
      });
      const orderIds = orders
        .map((o) => o.idexxOrderId)
        .filter(Boolean) as string[];
      if (!orderIds.length) {
        return [];
      }
      where.orderId = { in: orderIds };
    }

    return prisma.labResult.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: safeLimit && safeLimit > 0 ? safeLimit : undefined,
    });
  },

  async getByResultId(
    organisationId: string,
    provider: string,
    resultId: string,
  ) {
    const safeOrganisationId =
      typeof organisationId === "string" && organisationId.trim()
        ? organisationId
        : null;
    const safeProvider =
      typeof provider === "string" && provider.trim() ? provider : null;
    const safeResultId =
      typeof resultId === "string" && resultId.trim() ? resultId : null;
    if (!safeOrganisationId || !safeProvider || !safeResultId) {
      throw new LabResultServiceError(
        "Invalid organisationId, provider or resultId",
        400,
      );
    }
    return prisma.labResult.findFirst({
      where: {
        organisationId: safeOrganisationId,
        provider: safeProvider,
        resultId: safeResultId,
      },
    });
  },
};
