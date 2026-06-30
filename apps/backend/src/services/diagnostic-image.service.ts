import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class DiagnosticImageError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DiagnosticImageError";
  }
}

type ImagingType =
  | "RADIOGRAPH"
  | "ULTRASOUND"
  | "CT_SCAN"
  | "MRI"
  | "ENDOSCOPY"
  | "FLUOROSCOPY"
  | "SCINTIGRAPHY"
  | "OTHER";

type ImagingStatus = "PENDING_REVIEW" | "REVIEWED" | "REQUIRES_SPECIALIST";

export interface RecordDiagnosticImageParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  imagingType: ImagingType;
  bodyRegion?: string;
  indication?: string;
  takenAt: Date;
  takenBy?: string;
  interpretedBy?: string;
  interpretedAt?: Date;
  findings?: string;
  impression?: string;
  followUpRequired?: boolean;
  documentId?: string;
}

export interface ReviewDiagnosticImageParams {
  interpretedBy: string;
  findings: string;
  impression?: string;
  followUpRequired?: boolean;
  status?: ImagingStatus;
}

export interface UpdateDiagnosticImageParams {
  bodyRegion?: string;
  indication?: string;
  takenBy?: string;
  findings?: string;
  impression?: string;
  followUpRequired?: boolean;
  documentId?: string;
  status?: ImagingStatus;
}

export interface ListDiagnosticImagesParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  imagingType?: ImagingType;
  status?: ImagingStatus;
}

const imageSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  imagingType: true,
  bodyRegion: true,
  indication: true,
  takenAt: true,
  takenBy: true,
  interpretedBy: true,
  interpretedAt: true,
  findings: true,
  impression: true,
  followUpRequired: true,
  documentId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DiagnosticImageSelect;

const assertImage = async (id: string, organisationId: string) => {
  const record = await prisma.diagnosticImage.findFirst({
    where: { id, organisationId },
    select: imageSelect,
  });
  if (!record) {
    throw new DiagnosticImageError("Diagnostic image record not found.", 404);
  }
  return record;
};

export const DiagnosticImageService = {
  async record(params: RecordDiagnosticImageParams) {
    const { organisationId, patientId, takenBy, ...rest } = params;

    const record = await prisma.diagnosticImage.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        imagingType: rest.imagingType,
        bodyRegion: rest.bodyRegion ?? null,
        indication: rest.indication ?? null,
        takenAt: rest.takenAt,
        takenBy: takenBy ?? null,
        interpretedBy: rest.interpretedBy ?? null,
        interpretedAt: rest.interpretedAt ?? null,
        findings: rest.findings ?? null,
        impression: rest.impression ?? null,
        followUpRequired: rest.followUpRequired ?? false,
        documentId: rest.documentId ?? null,
        status: "PENDING_REVIEW",
      },
      select: imageSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "DIAGNOSTIC_IMAGE_RECORDED",
      actorType: "PMS_USER",
      actorId: takenBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: { imagingType: rest.imagingType, bodyRegion: rest.bodyRegion },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertImage(id, organisationId);
  },

  async list(params: ListDiagnosticImagesParams) {
    const { organisationId, patientId, encounterId, imagingType, status } =
      params;
    return prisma.diagnosticImage.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(imagingType ? { imagingType } : {}),
        ...(status ? { status } : {}),
      },
      select: imageSelect,
      orderBy: { takenAt: "desc" },
    });
  },

  async review(
    id: string,
    organisationId: string,
    params: ReviewDiagnosticImageParams,
    reviewedBy?: string,
  ) {
    await assertImage(id, organisationId);

    const updated = await prisma.diagnosticImage.update({
      where: { id },
      data: {
        interpretedBy: params.interpretedBy,
        interpretedAt: new Date(),
        findings: params.findings,
        impression: params.impression ?? null,
        followUpRequired: params.followUpRequired ?? false,
        status: params.status ?? "REVIEWED",
      },
      select: imageSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: updated.patientId,
      eventType: "DIAGNOSTIC_IMAGE_REVIEWED",
      actorType: "PMS_USER",
      actorId: reviewedBy ?? params.interpretedBy,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        imagingType: updated.imagingType,
        status: updated.status,
        followUpRequired: updated.followUpRequired,
      },
    });

    return updated;
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateDiagnosticImageParams,
  ) {
    await assertImage(id, organisationId);

    const data: Prisma.DiagnosticImageUpdateInput = {};
    if (params.bodyRegion !== undefined) data.bodyRegion = params.bodyRegion;
    if (params.indication !== undefined) data.indication = params.indication;
    if (params.takenBy !== undefined) data.takenBy = params.takenBy;
    if (params.findings !== undefined) data.findings = params.findings;
    if (params.impression !== undefined) data.impression = params.impression;
    if (params.followUpRequired !== undefined)
      data.followUpRequired = params.followUpRequired;
    if (params.documentId !== undefined) data.documentId = params.documentId;
    if (params.status !== undefined) data.status = params.status;

    return prisma.diagnosticImage.update({
      where: { id },
      data,
      select: imageSelect,
    });
  },
};
