import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PostOpCarePlanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PostOpCarePlanError";
  }
}

type PostOpCareStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface CreatePostOpCarePlanParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  surgicalProcedureId?: string;
  painScore?: number;
  analgesiaProtocol?: string;
  woundCareInstructions?: string;
  activityRestrictions?: string;
  dietaryNotes?: string;
  fluidTherapyNotes?: string;
  monitoringParams?: string;
  firstReviewAt?: Date;
  nextReviewAt?: Date;
  prescribedBy?: string;
  notes?: string;
}

export interface ReviewPostOpCarePlanParams {
  painScore?: number;
  reviewNotes: string;
  nextReviewAt?: Date;
  status?: PostOpCareStatus;
}

export interface UpdatePostOpCarePlanParams {
  analgesiaProtocol?: string;
  woundCareInstructions?: string;
  activityRestrictions?: string;
  dietaryNotes?: string;
  fluidTherapyNotes?: string;
  monitoringParams?: string;
  firstReviewAt?: Date;
  nextReviewAt?: Date;
  notes?: string;
  status?: PostOpCareStatus;
}

export interface ListPostOpCarePlansParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  status?: PostOpCareStatus;
}

const planSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  surgicalProcedureId: true,
  status: true,
  painScore: true,
  analgesiaProtocol: true,
  woundCareInstructions: true,
  activityRestrictions: true,
  dietaryNotes: true,
  fluidTherapyNotes: true,
  monitoringParams: true,
  firstReviewAt: true,
  nextReviewAt: true,
  reviewedBy: true,
  reviewNotes: true,
  prescribedBy: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PostOpCarePlanSelect;

const assertPlan = async (id: string, organisationId: string) => {
  const record = await prisma.postOpCarePlan.findFirst({
    where: { id, organisationId },
    select: planSelect,
  });
  if (!record) {
    throw new PostOpCarePlanError("Post-operative care plan not found.", 404);
  }
  return record;
};

export const PostOpCarePlanService = {
  async create(params: CreatePostOpCarePlanParams) {
    const { organisationId, patientId, prescribedBy, ...rest } = params;

    const record = await prisma.postOpCarePlan.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        surgicalProcedureId: rest.surgicalProcedureId ?? null,
        status: "ACTIVE",
        painScore: rest.painScore ?? null,
        analgesiaProtocol: rest.analgesiaProtocol ?? null,
        woundCareInstructions: rest.woundCareInstructions ?? null,
        activityRestrictions: rest.activityRestrictions ?? null,
        dietaryNotes: rest.dietaryNotes ?? null,
        fluidTherapyNotes: rest.fluidTherapyNotes ?? null,
        monitoringParams: rest.monitoringParams ?? null,
        firstReviewAt: rest.firstReviewAt ?? null,
        nextReviewAt: rest.nextReviewAt ?? null,
        prescribedBy: prescribedBy ?? null,
        notes: rest.notes ?? null,
      },
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "POST_OP_PLAN_CREATED",
      actorType: "PMS_USER",
      actorId: prescribedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        surgicalProcedureId: rest.surgicalProcedureId ?? null,
        painScore: rest.painScore ?? null,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertPlan(id, organisationId);
  },

  async list(params: ListPostOpCarePlansParams) {
    const { organisationId, patientId, encounterId, status } = params;
    return prisma.postOpCarePlan.findMany({
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

  async review(
    id: string,
    organisationId: string,
    params: ReviewPostOpCarePlanParams,
    reviewedBy?: string,
  ) {
    const record = await assertPlan(id, organisationId);
    if (record.status !== "ACTIVE") {
      throw new PostOpCarePlanError(
        "Can only review an ACTIVE post-operative care plan.",
        409,
      );
    }

    const updated = await prisma.postOpCarePlan.update({
      where: { id },
      data: {
        painScore: params.painScore ?? record.painScore,
        reviewNotes: params.reviewNotes,
        reviewedBy: reviewedBy ?? null,
        nextReviewAt: params.nextReviewAt ?? null,
        status: params.status ?? "ACTIVE",
      },
      select: planSelect,
    });

    const eventType =
      params.status === "COMPLETED"
        ? "POST_OP_PLAN_COMPLETED"
        : "POST_OP_PLAN_REVIEWED";

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType,
      actorType: "PMS_USER",
      actorId: reviewedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        painScore: params.painScore ?? null,
        status: updated.status,
      },
    });

    return updated;
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdatePostOpCarePlanParams,
  ) {
    await assertPlan(id, organisationId);

    const data: Prisma.PostOpCarePlanUpdateInput = {};
    if (params.analgesiaProtocol !== undefined)
      data.analgesiaProtocol = params.analgesiaProtocol;
    if (params.woundCareInstructions !== undefined)
      data.woundCareInstructions = params.woundCareInstructions;
    if (params.activityRestrictions !== undefined)
      data.activityRestrictions = params.activityRestrictions;
    if (params.dietaryNotes !== undefined)
      data.dietaryNotes = params.dietaryNotes;
    if (params.fluidTherapyNotes !== undefined)
      data.fluidTherapyNotes = params.fluidTherapyNotes;
    if (params.monitoringParams !== undefined)
      data.monitoringParams = params.monitoringParams;
    if (params.firstReviewAt !== undefined)
      data.firstReviewAt = params.firstReviewAt;
    if (params.nextReviewAt !== undefined)
      data.nextReviewAt = params.nextReviewAt;
    if (params.notes !== undefined) data.notes = params.notes;
    if (params.status !== undefined) data.status = params.status;

    return prisma.postOpCarePlan.update({
      where: { id },
      data,
      select: planSelect,
    });
  },
};
