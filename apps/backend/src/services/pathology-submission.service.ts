import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PathologySubmissionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PathologySubmissionError";
  }
}

type PathologyType =
  | "HISTOPATHOLOGY"
  | "CYTOLOGY"
  | "CULTURE_SENSITIVITY"
  | "HAEMATOLOGY"
  | "BIOCHEMISTRY"
  | "URINALYSIS"
  | "PCR"
  | "SEROLOGY"
  | "NECROPSY"
  | "OTHER";

type PathologyStatus =
  | "PENDING"
  | "RECEIVED_BY_LAB"
  | "PROCESSING"
  | "RESULTS_AVAILABLE"
  | "REVIEWED";

export interface CreatePathologySubmissionParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  pathologyType: PathologyType;
  sampleType: string;
  anatomicSite: string;
  collectedAt: Date;
  collectedBy?: string;
  submittedAt?: Date;
  labName?: string;
  labRefNumber?: string;
  clinicalHistory?: string;
  differentials?: string;
  notes?: string;
}

export interface RecordResultsParams {
  results: string;
  diagnosis?: string;
  interpretation?: string;
  status?: PathologyStatus;
}

export interface ReviewParams {
  reviewNotes?: string;
  diagnosis?: string;
  interpretation?: string;
}

export interface UpdatePathologySubmissionParams {
  submittedAt?: Date;
  labName?: string;
  labRefNumber?: string;
  clinicalHistory?: string;
  differentials?: string;
  status?: PathologyStatus;
  notes?: string;
}

export interface ListPathologySubmissionsParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  status?: PathologyStatus;
  pathologyType?: PathologyType;
}

const submissionSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  pathologyType: true,
  sampleType: true,
  anatomicSite: true,
  collectedAt: true,
  collectedBy: true,
  submittedAt: true,
  labName: true,
  labRefNumber: true,
  clinicalHistory: true,
  differentials: true,
  results: true,
  diagnosis: true,
  interpretation: true,
  reviewedBy: true,
  reviewedAt: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PathologySubmissionSelect;

const assertSubmission = async (id: string, organisationId: string) => {
  const record = await prisma.pathologySubmission.findFirst({
    where: { id, organisationId },
    select: submissionSelect,
  });
  if (!record) {
    throw new PathologySubmissionError("Pathology submission not found.", 404);
  }
  return record;
};

export const PathologySubmissionService = {
  async create(params: CreatePathologySubmissionParams) {
    const { organisationId, patientId, collectedBy, ...rest } = params;

    const submission = await prisma.pathologySubmission.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        pathologyType: rest.pathologyType,
        sampleType: rest.sampleType,
        anatomicSite: rest.anatomicSite,
        collectedAt: rest.collectedAt,
        collectedBy: collectedBy ?? null,
        submittedAt: rest.submittedAt ?? null,
        labName: rest.labName ?? null,
        labRefNumber: rest.labRefNumber ?? null,
        clinicalHistory: rest.clinicalHistory ?? null,
        differentials: rest.differentials ?? null,
        status: "PENDING",
        notes: rest.notes ?? null,
      },
      select: submissionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PATHOLOGY_SUBMITTED",
      actorType: "PMS_USER",
      actorId: collectedBy ?? null,
      entityType: "COMPANION",
      entityId: submission.id,
      metadata: {
        pathologyType: rest.pathologyType,
        anatomicSite: rest.anatomicSite,
        labName: rest.labName ?? null,
      },
    });

    return submission;
  },

  async get(id: string, organisationId: string) {
    return assertSubmission(id, organisationId);
  },

  async list(params: ListPathologySubmissionsParams) {
    const { organisationId, patientId, encounterId, status, pathologyType } =
      params;
    return prisma.pathologySubmission.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(status ? { status } : {}),
        ...(pathologyType ? { pathologyType } : {}),
      },
      select: submissionSelect,
      orderBy: { collectedAt: "desc" },
    });
  },

  async recordResults(
    id: string,
    organisationId: string,
    params: RecordResultsParams,
    recordedBy?: string,
  ) {
    await assertSubmission(id, organisationId);

    const updated = await prisma.pathologySubmission.update({
      where: { id },
      data: {
        results: params.results,
        diagnosis: params.diagnosis ?? null,
        interpretation: params.interpretation ?? null,
        status: params.status ?? "RESULTS_AVAILABLE",
      },
      select: submissionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: updated.patientId,
      eventType: "PATHOLOGY_RESULTS_RECORDED",
      actorType: "PMS_USER",
      actorId: recordedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { pathologyType: updated.pathologyType },
    });

    return updated;
  },

  async review(
    id: string,
    organisationId: string,
    params: ReviewParams,
    reviewedBy: string,
  ) {
    const existing = await assertSubmission(id, organisationId);
    if (!existing.results) {
      throw new PathologySubmissionError(
        "Cannot review a submission without results.",
        409,
      );
    }

    const updated = await prisma.pathologySubmission.update({
      where: { id },
      data: {
        diagnosis: params.diagnosis ?? existing.diagnosis,
        interpretation: params.interpretation ?? existing.interpretation,
        reviewedBy,
        reviewedAt: new Date(),
        status: "REVIEWED",
      },
      select: submissionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "PATHOLOGY_REVIEWED",
      actorType: "PMS_USER",
      actorId: reviewedBy,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        pathologyType: existing.pathologyType,
        diagnosis: params.diagnosis ?? null,
      },
    });

    return updated;
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdatePathologySubmissionParams,
  ) {
    await assertSubmission(id, organisationId);

    const data: Prisma.PathologySubmissionUpdateInput = {};
    if (params.submittedAt !== undefined) data.submittedAt = params.submittedAt;
    if (params.labName !== undefined) data.labName = params.labName;
    if (params.labRefNumber !== undefined)
      data.labRefNumber = params.labRefNumber;
    if (params.clinicalHistory !== undefined)
      data.clinicalHistory = params.clinicalHistory;
    if (params.differentials !== undefined)
      data.differentials = params.differentials;
    if (params.status !== undefined) data.status = params.status;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.pathologySubmission.update({
      where: { id },
      data,
      select: submissionSelect,
    });
  },
};
