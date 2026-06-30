import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PhysiotherapyPlanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PhysiotherapyPlanError";
  }
}

type PhysiotherapyStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "DISCONTINUED";

export interface CreatePhysiotherapyPlanParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  surgicalProcedureId?: string;
  diagnosis: string;
  goals?: string;
  frequency?: string;
  durationMinutes?: number;
  totalSessions?: number;
  exercisePrescription?: string;
  hydrotherapy?: boolean;
  laserTherapy?: boolean;
  therapeuticUltrasound?: boolean;
  massage?: boolean;
  acupuncture?: boolean;
  tapeApplication?: boolean;
  precautions?: string;
  homeExercises?: string;
  startDate?: Date;
  endDate?: Date;
  nextSessionAt?: Date;
  therapist?: string;
  prescribedBy?: string;
  notes?: string;
}

export interface UpdatePhysiotherapyPlanParams {
  diagnosis?: string;
  goals?: string;
  frequency?: string;
  durationMinutes?: number;
  totalSessions?: number;
  exercisePrescription?: string;
  hydrotherapy?: boolean;
  laserTherapy?: boolean;
  therapeuticUltrasound?: boolean;
  massage?: boolean;
  acupuncture?: boolean;
  tapeApplication?: boolean;
  precautions?: string;
  homeExercises?: string;
  startDate?: Date;
  endDate?: Date;
  lastSessionAt?: Date;
  nextSessionAt?: Date;
  therapist?: string;
  status?: PhysiotherapyStatus;
  notes?: string;
}

export interface ListPhysiotherapyPlansParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  status?: PhysiotherapyStatus;
}

const planSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  surgicalProcedureId: true,
  diagnosis: true,
  goals: true,
  frequency: true,
  durationMinutes: true,
  totalSessions: true,
  exercisePrescription: true,
  hydrotherapy: true,
  laserTherapy: true,
  therapeuticUltrasound: true,
  massage: true,
  acupuncture: true,
  tapeApplication: true,
  precautions: true,
  homeExercises: true,
  startDate: true,
  endDate: true,
  lastSessionAt: true,
  nextSessionAt: true,
  therapist: true,
  prescribedBy: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PhysiotherapyPlanSelect;

const assertPlan = async (id: string, organisationId: string) => {
  const record = await prisma.physiotherapyPlan.findFirst({
    where: { id, organisationId },
    select: planSelect,
  });
  if (!record) {
    throw new PhysiotherapyPlanError("Physiotherapy plan not found.", 404);
  }
  return record;
};

export const PhysiotherapyPlanService = {
  async create(params: CreatePhysiotherapyPlanParams) {
    const { organisationId, patientId, prescribedBy, ...rest } = params;

    const record = await prisma.physiotherapyPlan.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        surgicalProcedureId: rest.surgicalProcedureId ?? null,
        diagnosis: rest.diagnosis,
        goals: rest.goals ?? null,
        frequency: rest.frequency ?? null,
        durationMinutes: rest.durationMinutes ?? null,
        totalSessions: rest.totalSessions ?? null,
        exercisePrescription: rest.exercisePrescription ?? null,
        hydrotherapy: rest.hydrotherapy ?? false,
        laserTherapy: rest.laserTherapy ?? false,
        therapeuticUltrasound: rest.therapeuticUltrasound ?? false,
        massage: rest.massage ?? false,
        acupuncture: rest.acupuncture ?? false,
        tapeApplication: rest.tapeApplication ?? false,
        precautions: rest.precautions ?? null,
        homeExercises: rest.homeExercises ?? null,
        startDate: rest.startDate ?? null,
        endDate: rest.endDate ?? null,
        nextSessionAt: rest.nextSessionAt ?? null,
        therapist: rest.therapist ?? null,
        prescribedBy: prescribedBy ?? null,
        status: "ACTIVE",
        notes: rest.notes ?? null,
      },
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PHYSIOTHERAPY_PLAN_CREATED",
      actorType: "PMS_USER",
      actorId: prescribedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: { diagnosis: rest.diagnosis },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertPlan(id, organisationId);
  },

  async list(params: ListPhysiotherapyPlansParams) {
    const { organisationId, patientId, encounterId, status } = params;
    return prisma.physiotherapyPlan.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(status ? { status } : {}),
      },
      select: planSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdatePhysiotherapyPlanParams,
    updatedBy?: string,
  ) {
    const existing = await assertPlan(id, organisationId);
    if (existing.status === "DISCONTINUED") {
      throw new PhysiotherapyPlanError(
        "Cannot update a discontinued physiotherapy plan.",
        409,
      );
    }

    const data: Prisma.PhysiotherapyPlanUpdateInput = {};
    if (params.diagnosis !== undefined) data.diagnosis = params.diagnosis;
    if (params.goals !== undefined) data.goals = params.goals;
    if (params.frequency !== undefined) data.frequency = params.frequency;
    if (params.durationMinutes !== undefined)
      data.durationMinutes = params.durationMinutes;
    if (params.totalSessions !== undefined)
      data.totalSessions = params.totalSessions;
    if (params.exercisePrescription !== undefined)
      data.exercisePrescription = params.exercisePrescription;
    if (params.hydrotherapy !== undefined)
      data.hydrotherapy = params.hydrotherapy;
    if (params.laserTherapy !== undefined)
      data.laserTherapy = params.laserTherapy;
    if (params.therapeuticUltrasound !== undefined)
      data.therapeuticUltrasound = params.therapeuticUltrasound;
    if (params.massage !== undefined) data.massage = params.massage;
    if (params.acupuncture !== undefined) data.acupuncture = params.acupuncture;
    if (params.tapeApplication !== undefined)
      data.tapeApplication = params.tapeApplication;
    if (params.precautions !== undefined) data.precautions = params.precautions;
    if (params.homeExercises !== undefined)
      data.homeExercises = params.homeExercises;
    if (params.startDate !== undefined) data.startDate = params.startDate;
    if (params.endDate !== undefined) data.endDate = params.endDate;
    if (params.lastSessionAt !== undefined)
      data.lastSessionAt = params.lastSessionAt;
    if (params.nextSessionAt !== undefined)
      data.nextSessionAt = params.nextSessionAt;
    if (params.therapist !== undefined) data.therapist = params.therapist;
    if (params.status !== undefined) data.status = params.status;
    if (params.notes !== undefined) data.notes = params.notes;

    const eventType =
      params.status === "DISCONTINUED"
        ? "PHYSIOTHERAPY_PLAN_DISCONTINUED"
        : "PHYSIOTHERAPY_PLAN_UPDATED";

    const updated = await prisma.physiotherapyPlan.update({
      where: { id },
      data,
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType,
      actorType: "PMS_USER",
      actorId: updatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { status: updated.status },
    });

    return updated;
  },
};
