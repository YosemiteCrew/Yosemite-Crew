import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class AdverseEventReportError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AdverseEventReportError";
  }
}

type AdverseEventStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REVIEWING"
  | "FORWARDED"
  | "CLOSED";

const CLOSED_STATUSES: AdverseEventStatus[] = ["CLOSED", "FORWARDED"];

export interface CreateAdverseEventParams {
  organisationId?: string;
  appointmentId?: string;
  reporter: Record<string, unknown>;
  patient: Record<string, unknown>;
  product: Record<string, unknown>;
  destinations: Record<string, unknown>;
  consent: Record<string, unknown>;
  status?: AdverseEventStatus;
}

const adverseEventSelect = {
  id: true,
  organisationId: true,
  appointmentId: true,
  reporter: true,
  patient: true,
  product: true,
  destinations: true,
  consent: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdverseEventReportSelect;

const assertReport = async (id: string, organisationId?: string) => {
  const report = await prisma.adverseEventReport.findFirst({
    where: {
      id,
      ...(organisationId ? { organisationId } : {}),
    },
    select: adverseEventSelect,
  });
  if (!report)
    throw new AdverseEventReportError("Adverse event report not found.", 404);
  return report;
};

export const AdverseEventReportService = {
  async create(params: CreateAdverseEventParams) {
    const report = await prisma.adverseEventReport.create({
      data: {
        organisationId: params.organisationId ?? null,
        appointmentId: params.appointmentId ?? null,
        reporter: params.reporter as Prisma.InputJsonValue,
        patient: params.patient as Prisma.InputJsonValue,
        product: params.product as Prisma.InputJsonValue,
        destinations: params.destinations as Prisma.InputJsonValue,
        consent: params.consent as Prisma.InputJsonValue,
        status: params.status ?? "SUBMITTED",
      },
      select: adverseEventSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId ?? "",
      patientId: "",
      eventType: "ADVERSE_EVENT_REPORTED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: report.id,
      metadata: {
        appointmentId: params.appointmentId,
        status: report.status,
      },
    });

    return report;
  },

  async get(id: string, organisationId?: string) {
    return assertReport(id, organisationId);
  },

  async list(params: {
    organisationId?: string;
    status?: AdverseEventStatus;
    appointmentId?: string;
  }) {
    const { organisationId, status, appointmentId } = params;
    return prisma.adverseEventReport.findMany({
      where: {
        ...(organisationId ? { organisationId } : {}),
        ...(status ? { status } : {}),
        ...(appointmentId ? { appointmentId } : {}),
      },
      select: adverseEventSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async updateStatus(
    id: string,
    status: AdverseEventStatus,
    organisationId?: string,
  ) {
    const existing = await assertReport(id, organisationId);
    if (existing.status === "CLOSED") {
      throw new AdverseEventReportError(
        "A CLOSED adverse event report cannot be modified.",
        409,
      );
    }
    return prisma.adverseEventReport.update({
      where: { id },
      data: { status },
      select: adverseEventSelect,
    });
  },
};
