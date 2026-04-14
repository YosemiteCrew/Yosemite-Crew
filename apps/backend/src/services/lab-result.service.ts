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
    companionId?: string;
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

      if (params.companionId) {
        if (!Types.ObjectId.isValid(params.companionId)) {
          throw new LabResultServiceError("Invalid companionId", 400);
        }
        const orders = await prisma.labOrder.findMany({
          where: { companionId: params.companionId },
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

    if (params.companionId) {
      if (!Types.ObjectId.isValid(params.companionId)) {
        throw new LabResultServiceError("Invalid companionId", 400);
      }
      const orders = await LabOrderModel.find(
        { companionId: params.companionId },
        { idexxOrderId: 1 },
      )
        .setOptions({ sanitizeFilter: true })
        .lean();
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

  async getByResultId(provider: string, resultId: string) {
    const safeProvider =
      typeof provider === "string" && provider.trim() ? provider : null;
    const safeResultId =
      typeof resultId === "string" && resultId.trim() ? resultId : null;
    if (!safeProvider || !safeResultId) {
      throw new LabResultServiceError("Invalid provider or resultId", 400);
    }
    if (isReadFromPostgres()) {
      return prisma.labResult.findFirst({
        where: { provider: safeProvider, resultId: safeResultId },
      });
    }
    return LabResultModel.findOne({
      provider: safeProvider,
      resultId: safeResultId,
    })
      .setOptions({ sanitizeFilter: true })
      .lean();
  },
};
