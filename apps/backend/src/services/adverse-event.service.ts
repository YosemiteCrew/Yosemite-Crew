// src/services/adverseEvent.service.ts
import { AdverseEventReport, AdverseEventStatus } from "@yosemite-crew/types";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export class AdverseEventServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "AdverseEventServiceError";
  }
}

const toInputJsonObject = (value: unknown): Prisma.InputJsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const toDomainFromPrisma = (row: {
  id: string;
  organisationId: string | null;
  appointmentId: string | null;
  reporter: Prisma.JsonValue;
  patient: Prisma.JsonValue;
  companion?: Prisma.JsonValue;
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
  patient: row.patient as unknown as AdverseEventReport["patient"],
  companion: (row.companion ??
    row.patient) as unknown as AdverseEventReport["companion"],
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
    if (!input.patient?.name) {
      throw new AdverseEventServiceError("companion name is required", 400);
    }

    const doc = await prisma.adverseEventReport.create({
      data: {
        organisationId: input.organisationId ?? undefined,
        appointmentId: input.appointmentId ?? undefined,
        reporter: toInputJsonObject(input.reporter),
        patient: toInputJsonObject(input.patient),
        product: toInputJsonObject(input.product),
        destinations: toInputJsonObject(input.destinations),
        consent: {
          agreedToContact: input.consent?.agreedToContact ?? false,
          agreedToTermsAt: input.consent?.agreedToTermsAt ?? new Date(),
        },
        status: "SUBMITTED",
      },
    });
    return toDomainFromPrisma({
      ...doc,
      reporter: doc.reporter,
      patient: doc.patient,
      companion: doc.patient,
      product: doc.product,
      destinations: doc.destinations,
      consent: doc.consent,
    });
  },

  async getById(id: string): Promise<AdverseEventReport | null> {
    const row = await prisma.adverseEventReport.findUnique({ where: { id } });
    return row
      ? toDomainFromPrisma({
          ...row,
          reporter: row.reporter,
          patient: row.patient,
          companion: row.patient,
          product: row.product,
          destinations: row.destinations,
          consent: row.consent,
        })
      : null;
  },

  async listForOrganisation(
    orgId: string,
    options?: { status?: AdverseEventStatus },
  ) {
    const rows = await prisma.adverseEventReport.findMany({
      where: {
        organisationId: orgId,
        status: options?.status ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) =>
      toDomainFromPrisma({
        ...row,
        reporter: row.reporter,
        patient: row.patient,
        companion: row.patient,
        product: row.product,
        destinations: row.destinations,
        consent: row.consent,
      }),
    );
  },

  async updateStatus(id: string, status: AdverseEventStatus) {
    const row = await prisma.adverseEventReport.update({
      where: { id },
      data: { status },
    });
    return toDomainFromPrisma({
      ...row,
      reporter: row.reporter,
      patient: row.patient,
      companion: row.patient,
      product: row.product,
      destinations: row.destinations,
      consent: row.consent,
    });
  },
};
