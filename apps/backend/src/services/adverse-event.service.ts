// src/services/adverseEvent.service.ts
import AdverseEventReportModel, {
  AdverseEventReportDocument,
} from "../models/adverse-event";
import { AdverseEventReport, AdverseEventStatus } from "@yosemite-crew/types";

export class AdverseEventServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "AdverseEventServiceError";
  }
}

const toDomain = (doc: AdverseEventReportDocument): AdverseEventReport => {
  const obj = doc.toObject();
  return {
    id: doc._id.toString(),
    organisationId: obj.organisationId,
    appointmentId: obj.appointmentId ?? null,
    reporter: obj.reporter,
    companion: obj.companion,
    product: obj.product,
    destinations: obj.destinations,
    consent: obj.consent,
    status: obj.status,
    createdAt: doc.createdAt!,
    updatedAt: doc.updatedAt!,
  };
};

export const AdverseEventService = {
  async createFromMobile(input: AdverseEventReport): Promise<AdverseEventReport> {
    if (!input.reporter?.firstName || !input.reporter?.email) {
      throw new AdverseEventServiceError(
        "Reporter firstName and email are required",
        400,
      );
    }
    if (!input.product?.productName) {
      throw new AdverseEventServiceError("productName is required", 400);
    }
    if (!input.companion?.name) {
      throw new AdverseEventServiceError("companion name is required", 400);
    }

    const doc = await AdverseEventReportModel.create({
      organisationId: input.organisationId,
      appointmentId: input.appointmentId ?? null,
      reporter: input.reporter,
      companion: input.companion,
      product: input.product,
      destinations: input.destinations,
      consent: {
        agreedToContact: input.consent?.agreedToContact ?? false,
        agreedToTermsAt: input.consent?.agreedToTermsAt ?? new Date(),
      },
      status: "SUBMITTED",
    });

    return toDomain(doc);
  },

  async getById(id: string): Promise<AdverseEventReport | null> {
    const doc = await AdverseEventReportModel.findById(id);
    return doc ? toDomain(doc) : null;
  },

  async listForOrganisation(orgId: string, options?: { status?: string }) {
    const query: any = { organisationId: orgId };
    if (options?.status) query.status = options.status;

    const docs = await AdverseEventReportModel.find(query)
      .sort({ createdAt: -1 })
      .exec();
    return docs.map(toDomain);
  },

  async updateStatus(id: string, status: AdverseEventStatus) {
    const doc = await AdverseEventReportModel.findById(id);
    if (!doc) throw new AdverseEventServiceError("Report not found", 404);

    doc.status = status;
    await doc.save();
    return toDomain(doc);
  },
};