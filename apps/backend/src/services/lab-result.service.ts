import LabResultModel from "src/models/lab-result";
import LabOrderModel from "src/models/lab-order";
import { Types } from "mongoose";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";

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
    const filter: Record<string, unknown> = {};
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

    if (isReadFromPostgres()) {
      const where: Record<string, unknown> = {};
      if (safeOrganisationId) where.organisationId = safeOrganisationId;
      if (safeProvider) where.provider = safeProvider;
      if (safeOrderId) where.orderId = safeOrderId;

      if (params.patientId) {
        if (!Types.ObjectId.isValid(params.patientId)) {
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
    }

    if (safeOrganisationId) filter.organisationId = safeOrganisationId;
    if (safeProvider) filter.provider = safeProvider;
    if (safeOrderId) filter.orderId = safeOrderId;

    if (params.patientId) {
      if (!Types.ObjectId.isValid(params.patientId)) {
        throw new LabResultServiceError("Invalid patientId", 400);
      }
      const orders = (await LabOrderModel.find(
        { patientId: params.patientId },
        { idexxOrderId: 1 },
      )
        .setOptions({ sanitizeFilter: true })
        .lean()) as unknown as Array<{ idexxOrderId?: string | null }>;
      const orderIds = orders
        .map((o) => o.idexxOrderId)
        .filter(Boolean) as string[];
      if (!orderIds.length) {
        return [];
      }
      filter.orderId = { $in: orderIds };
    }

    const query = LabResultModel.find(filter).sort({ updatedAt: -1 });
    const shouldSanitize =
      filter.orderId == null || typeof filter.orderId === "string";
    if (shouldSanitize) {
      query.setOptions({ sanitizeFilter: true });
    }

    if (safeLimit && safeLimit > 0) {
      query.limit(safeLimit);
    }

    return query.lean();
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
    if (isReadFromPostgres()) {
      return prisma.labResult.findFirst({
        where: {
          organisationId: safeOrganisationId,
          provider: safeProvider,
          resultId: safeResultId,
        },
      });
    }
    return LabResultModel.findOne({
      organisationId: safeOrganisationId,
      provider: safeProvider,
      resultId: safeResultId,
    })
      .setOptions({ sanitizeFilter: true })
      .lean();
  },
};
