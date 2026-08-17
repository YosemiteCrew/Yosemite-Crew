import { prisma } from "src/config/prisma";
import { pickDefined } from "src/utils/pick-defined";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PreOpAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PreOpAssessmentError";
  }
}

type AsaClass = "ASA_I" | "ASA_II" | "ASA_III" | "ASA_IV" | "ASA_V" | "ASA_E";

export interface CreatePreOpParams {
  organisationId: string;
  patientId: string;
  encounterId: string;
  asaClass?: AsaClass;
  fastingStartedAt?: Date;
  labsReviewed?: boolean;
  ecgReviewed?: boolean;
  ownerConsentSigned?: boolean;
  anesthetistId?: string;
  surgeonId?: string;
  plannedProcedure?: string;
  anesthesiaType?: string;
  knownAllergies?: string;
  currentMedications?: string;
  airwayNotes?: string;
  cardiovascularNotes?: string;
  notes?: string;
  assessedBy?: string;
  assessedAt?: Date;
}

export type UpdatePreOpParams = Partial<
  Omit<CreatePreOpParams, "organisationId" | "patientId" | "encounterId">
>;

const preOpSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  asaClass: true,
  fastingStartedAt: true,
  labsReviewed: true,
  ecgReviewed: true,
  ownerConsentSigned: true,
  anesthetistId: true,
  surgeonId: true,
  plannedProcedure: true,
  anesthesiaType: true,
  knownAllergies: true,
  currentMedications: true,
  airwayNotes: true,
  cardiovascularNotes: true,
  notes: true,
  assessedBy: true,
  assessedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PreOpAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const assessment = await prisma.preOpAssessment.findFirst({
    where: { id, organisationId },
    select: preOpSelect,
  });
  if (!assessment) {
    throw new PreOpAssessmentError("Pre-op assessment not found.", 404);
  }
  return assessment;
};

export const PreOpAssessmentService = {
  async create(params: CreatePreOpParams) {
    const { organisationId, patientId, assessedBy, ...rest } = params;

    const assessment = await prisma.preOpAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId,
        asaClass: rest.asaClass ?? "ASA_I",
        fastingStartedAt: rest.fastingStartedAt ?? null,
        labsReviewed: rest.labsReviewed ?? false,
        ecgReviewed: rest.ecgReviewed ?? false,
        ownerConsentSigned: rest.ownerConsentSigned ?? false,
        anesthetistId: rest.anesthetistId ?? null,
        surgeonId: rest.surgeonId ?? null,
        plannedProcedure: rest.plannedProcedure ?? null,
        anesthesiaType: rest.anesthesiaType ?? null,
        knownAllergies: rest.knownAllergies ?? null,
        currentMedications: rest.currentMedications ?? null,
        airwayNotes: rest.airwayNotes ?? null,
        cardiovascularNotes: rest.cardiovascularNotes ?? null,
        notes: rest.notes ?? null,
        assessedBy: assessedBy ?? null,
        assessedAt: rest.assessedAt ?? new Date(),
      },
      select: preOpSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PRE_OP_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: {
        asaClass: rest.asaClass ?? "ASA_I",
        encounterId: rest.encounterId,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    encounterId?: string;
    asaClass?: AsaClass;
  }) {
    const { organisationId, patientId, encounterId, asaClass } = params;
    return prisma.preOpAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(asaClass ? { asaClass } : {}),
      },
      select: preOpSelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async update(id: string, organisationId: string, params: UpdatePreOpParams) {
    await assertAssessment(id, organisationId);

    const data: Prisma.PreOpAssessmentUpdateInput = pickDefined(params, [
      "asaClass",
      "fastingStartedAt",
      "labsReviewed",
      "ecgReviewed",
      "ownerConsentSigned",
      "anesthetistId",
      "surgeonId",
      "plannedProcedure",
      "anesthesiaType",
      "knownAllergies",
      "currentMedications",
      "airwayNotes",
      "cardiovascularNotes",
      "notes",
      "assessedBy",
      "assessedAt",
    ]);

    return prisma.preOpAssessment.update({
      where: { id },
      data,
      select: preOpSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertAssessment(id, organisationId);
    await prisma.preOpAssessment.delete({ where: { id } });
  },
};
