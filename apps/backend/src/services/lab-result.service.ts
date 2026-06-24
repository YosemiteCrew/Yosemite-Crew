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

const normalizeOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const resolvePatientFilter = async (patientId?: string) => {
  if (!patientId) {
    return undefined;
  }

  if (!patientId.trim()) {
    throw new LabResultServiceError("Invalid patientId", 400);
  }

  const orders = await prisma.labOrder.findMany({
    where: { patientId },
    select: { idexxOrderId: true },
  });

  const orderIds = orders
    .map((order) => order.idexxOrderId)
    .filter(Boolean) as string[];

  return {
    OR: [
      { patientId },
      ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
    ],
  };
};

export const LabResultService = {
  async list(params: {
    organisationId?: string;
    provider?: string;
    orderId?: string;
    patientId?: string;
    limit?: number;
  }) {
    const safeOrganisationId = normalizeOptionalString(params.organisationId);
    const safeProvider = normalizeOptionalString(params.provider);
    const safeOrderId = normalizeOptionalString(params.orderId);
    const safeLimit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.floor(params.limit)
        : undefined;

    const where: Record<string, unknown> = {};
    if (safeOrganisationId) where.organisationId = safeOrganisationId;
    if (safeProvider) where.provider = safeProvider;
    if (safeOrderId) where.orderId = safeOrderId;
    const patientFilter = await resolvePatientFilter(params.patientId);
    if (patientFilter) {
      where.OR = patientFilter.OR;
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
    const safeOrganisationId = normalizeOptionalString(organisationId);
    const safeProvider = normalizeOptionalString(provider);
    const safeResultId = normalizeOptionalString(resultId);
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
