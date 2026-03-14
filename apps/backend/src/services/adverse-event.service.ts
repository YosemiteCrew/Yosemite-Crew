// src/services/adverseEvent.service.ts
import AdverseEventReportModel, {
  AdverseEventReportDocument,
} from "../models/adverse-event";
import { FilterQuery } from "mongoose";
import { AdverseEventReport, AdverseEventStatus } from "@yosemite-crew/types";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";

export class AdverseEventServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "AdverseEventServiceError";
  }
}

const toDomain = (doc: AdverseEventReportDocument): AdverseEventReport => ({
  id: doc._id.toString(),
  organisationId: doc.organisationId,
  appointmentId: doc.appointmentId ?? null,
  reporter: doc.reporter,
  companion: doc.companion,
  product: doc.product,
  destinations: doc.destinations,
  consent: doc.consent,
  status: doc.status,
  createdAt: doc.createdAt!,
  updatedAt: doc.updatedAt!,
});

const toDomainFromPrisma = (row: {
  id: string;
  organisationId: string | null;
  appointmentId: string | null;
  reporter: Prisma.JsonValue;
  companion: Prisma.JsonValue;
  product: Prisma.JsonValue;
  destinations: Prisma.JsonValue;
  consent: Prisma.JsonValue;
  status: AdverseEventStatus;
  createdAt: Date;
  updatedAt: Date;
}): AdverseEventReport => ({
  id: row.id,
  organisationId: row.organisationId ?? undefined,
  appointmentId: row.appointmentId ?? null,
  reporter: row.reporter as unknown as AdverseEventReport["reporter"],
  companion: row.companion as unknown as AdverseEventReport["companion"],
  product: row.product as unknown as AdverseEventReport["product"],
  destinations:
    row.destinations as unknown as AdverseEventReport["destinations"],
  consent: row.consent as unknown as AdverseEventReport["consent"],
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const AdverseEventService = {
  async createFromMobile(
    input: AdverseEventReport,
  ): Promise<AdverseEventReport> {
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

    if (isReadFromPostgres()) {
      const doc = await prisma.adverseEventReport.create({
        data: {
          organisationId: input.organisationId ?? undefined,
          appointmentId: input.appointmentId ?? undefined,
          reporter: input.reporter as unknown as Prisma.InputJsonValue,
          companion: input.companion as unknown as Prisma.InputJsonValue,
          product: input.product as unknown as Prisma.InputJsonValue,
          destinations: input.destinations as unknown as Prisma.InputJsonValue,
          consent: {
            agreedToContact: input.consent?.agreedToContact ?? false,
            agreedToTermsAt: input.consent?.agreedToTermsAt ?? new Date(),
          } as unknown as Prisma.InputJsonValue,
          status: "SUBMITTED",
        },
      });
      return toDomainFromPrisma(doc);
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

    if (shouldDualWrite) {
      try {
        await prisma.adverseEventReport.create({
          data: {
            id: doc._id.toString(),
            organisationId: input.organisationId ?? undefined,
            appointmentId: input.appointmentId ?? undefined,
            reporter: input.reporter as unknown as Prisma.InputJsonValue,
            companion: input.companion as unknown as Prisma.InputJsonValue,
            product: input.product as unknown as Prisma.InputJsonValue,
            destinations:
              input.destinations as unknown as Prisma.InputJsonValue,
            consent: {
              agreedToContact: input.consent?.agreedToContact ?? false,
              agreedToTermsAt: input.consent?.agreedToTermsAt ?? new Date(),
            } as unknown as Prisma.InputJsonValue,
            status: "SUBMITTED",
            createdAt: doc.createdAt ?? undefined,
            updatedAt: doc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("AdverseEventReport", err);
      }
    }

    return toDomain(doc);
  },

  async getById(id: string): Promise<AdverseEventReport | null> {
    if (isReadFromPostgres()) {
      const row = await prisma.adverseEventReport.findUnique({ where: { id } });
      return row ? toDomainFromPrisma(row) : null;
    }
    const doc = await AdverseEventReportModel.findById(id);
    return doc ? toDomain(doc) : null;
  },

  async listForOrganisation(
    orgId: string,
    options?: { status?: AdverseEventStatus },
  ) {
    const query: FilterQuery<AdverseEventReportDocument> = {
      organisationId: orgId,
    };
    if (options?.status) query.status = options.status;

    if (isReadFromPostgres()) {
      const rows = await prisma.adverseEventReport.findMany({
        where: {
          organisationId: orgId,
          status: options?.status ?? undefined,
        },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainFromPrisma);
    }

    const docs = await AdverseEventReportModel.find(query)
      .sort({ createdAt: -1 })
      .exec();
    return docs.map(toDomain);
  },

  async updateStatus(id: string, status: AdverseEventStatus) {
    if (isReadFromPostgres()) {
      const row = await prisma.adverseEventReport.update({
        where: { id },
        data: { status },
      });
      return toDomainFromPrisma(row);
    }

    const doc = await AdverseEventReportModel.findById(id);
    if (!doc) throw new AdverseEventServiceError("Report not found", 404);

    doc.status = status;
    await doc.save();

    if (shouldDualWrite) {
      try {
        await prisma.adverseEventReport.updateMany({
          where: { id },
          data: { status },
        });
      } catch (err) {
        handleDualWriteError("AdverseEventReport", err);
      }
    }
    return toDomain(doc);
  },
};
