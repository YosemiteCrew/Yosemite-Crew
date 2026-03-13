import LabResultModel from "src/models/lab-result";
import LabOrderModel from "src/models/lab-order";
import { Types } from "mongoose";

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

    if (params.organisationId) filter.organisationId = params.organisationId;
    if (params.provider) filter.provider = params.provider;
    if (params.orderId) filter.orderId = params.orderId;

    if (params.companionId) {
      if (!Types.ObjectId.isValid(params.companionId)) {
        throw new LabResultServiceError("Invalid companionId", 400);
      }
      const orders = await LabOrderModel.find(
        { companionId: params.companionId },
        { idexxOrderId: 1 },
      ).lean();
      const orderIds = orders
        .map((o) => o.idexxOrderId)
        .filter(Boolean) as string[];
      filter.orderId = { $in: orderIds };
    }

    const query = LabResultModel.find(filter).sort({ updatedAt: -1 });

    if (params.limit && params.limit > 0) {
      query.limit(params.limit);
    }

    return query.lean();
  },

  async getByResultId(provider: string, resultId: string) {
    return LabResultModel.findOne({ provider, resultId }).lean();
  },
};
