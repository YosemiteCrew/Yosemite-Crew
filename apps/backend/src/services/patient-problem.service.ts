import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PatientProblemError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PatientProblemError";
  }
}

type ProblemStatus = "ACTIVE" | "INACTIVE" | "RESOLVED";
type ProblemSeverity = "MILD" | "MODERATE" | "SEVERE";

export interface CreatePatientProblemParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  name: string;
  codeSystem?: string;
  code?: string;
  severity?: ProblemSeverity;
  onsetDate?: Date;
  notes?: string;
  recordedBy?: string;
}

export interface UpdatePatientProblemParams {
  name?: string;
  codeSystem?: string;
  code?: string;
  status?: ProblemStatus;
  severity?: ProblemSeverity;
  onsetDate?: Date;
  resolvedDate?: Date;
  notes?: string;
}

export interface ListPatientProblemsParams {
  organisationId: string;
  patientId?: string;
  status?: ProblemStatus;
}

const problemSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  name: true,
  codeSystem: true,
  code: true,
  status: true,
  severity: true,
  onsetDate: true,
  resolvedDate: true,
  notes: true,
  recordedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientProblemSelect;

const assertProblem = async (id: string, organisationId: string) => {
  const problem = await prisma.patientProblem.findFirst({
    where: { id, organisationId },
    select: problemSelect,
  });
  if (!problem) {
    throw new PatientProblemError("Problem not found.", 404);
  }
  return problem;
};

export const PatientProblemService = {
  async create(params: CreatePatientProblemParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      name,
      codeSystem,
      code,
      severity,
      onsetDate,
      notes,
      recordedBy,
    } = params;

    const problem = await prisma.patientProblem.create({
      data: {
        organisationId,
        patientId,
        encounterId: encounterId ?? null,
        name,
        codeSystem: codeSystem ?? null,
        code: code ?? null,
        severity: severity ?? null,
        onsetDate: onsetDate ?? null,
        resolvedDate: null,
        notes: notes ?? null,
        recordedBy: recordedBy ?? null,
        status: "ACTIVE",
      },
      select: problemSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PROBLEM_CREATED",
      actorType: "PMS_USER",
      actorId: recordedBy ?? null,
      entityType: "COMPANION",
      entityId: problem.id,
      metadata: { name, code, codeSystem, severity },
    });

    return problem;
  },

  async get(id: string, organisationId: string) {
    return assertProblem(id, organisationId);
  },

  async list(params: ListPatientProblemsParams) {
    const { organisationId, patientId, status } = params;
    return prisma.patientProblem.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
      },
      select: problemSelect,
      orderBy: [
        { status: "asc" },
        { onsetDate: "desc" },
        { createdAt: "desc" },
      ],
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdatePatientProblemParams,
    updatedBy?: string,
  ) {
    const problem = await assertProblem(id, organisationId);
    if (
      problem.status === "RESOLVED" &&
      params.status !== "ACTIVE" &&
      params.status !== "INACTIVE"
    ) {
      // Allow reactivating a resolved problem
    }

    const data: Prisma.PatientProblemUpdateInput = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.codeSystem !== undefined) data.codeSystem = params.codeSystem;
    if (params.code !== undefined) data.code = params.code;
    if (params.status !== undefined) data.status = params.status;
    if (params.severity !== undefined) data.severity = params.severity;
    if (params.onsetDate !== undefined) data.onsetDate = params.onsetDate;
    if (params.resolvedDate !== undefined)
      data.resolvedDate = params.resolvedDate;
    if (params.notes !== undefined) data.notes = params.notes;

    const updated = await prisma.patientProblem.update({
      where: { id },
      data,
      select: problemSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: problem.patientId,
      eventType: "PROBLEM_UPDATED",
      actorType: "PMS_USER",
      actorId: updatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { changedFields: Object.keys(params) },
    });

    return updated;
  },

  async resolve(
    id: string,
    organisationId: string,
    resolvedBy?: string,
    resolvedDate?: Date,
  ) {
    const problem = await assertProblem(id, organisationId);
    if (problem.status === "RESOLVED") {
      throw new PatientProblemError("Problem is already resolved.", 409);
    }

    const updated = await prisma.patientProblem.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedDate: resolvedDate ?? new Date(),
      },
      select: problemSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: problem.patientId,
      eventType: "PROBLEM_RESOLVED",
      actorType: "PMS_USER",
      actorId: resolvedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { name: problem.name },
    });

    return updated;
  },
};
