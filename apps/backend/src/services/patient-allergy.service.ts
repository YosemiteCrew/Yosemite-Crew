import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PatientAllergyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PatientAllergyError";
  }
}

type AllergyType = "DRUG" | "FOOD" | "ENVIRONMENTAL" | "OTHER";
type AllergySeverity = "MILD" | "MODERATE" | "SEVERE" | "LIFE_THREATENING";
type AllergyStatus = "ACTIVE" | "RESOLVED" | "UNCONFIRMED";

export interface CreatePatientAllergyParams {
  organisationId: string;
  patientId: string;
  allergen: string;
  allergyType: AllergyType;
  severity: AllergySeverity;
  reaction?: string;
  status?: AllergyStatus;
  onsetDate?: Date;
  notes?: string;
  recordedBy?: string;
}

export interface UpdatePatientAllergyParams {
  allergen?: string;
  allergyType?: AllergyType;
  severity?: AllergySeverity;
  reaction?: string;
  status?: AllergyStatus;
  onsetDate?: Date;
  resolvedDate?: Date;
  notes?: string;
}

export interface ListPatientAllergiesParams {
  organisationId: string;
  patientId?: string;
  status?: AllergyStatus;
  allergyType?: AllergyType;
}

const allergySelect = {
  id: true,
  organisationId: true,
  patientId: true,
  allergen: true,
  allergyType: true,
  severity: true,
  reaction: true,
  status: true,
  onsetDate: true,
  resolvedDate: true,
  notes: true,
  recordedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientAllergySelect;

const assertAllergy = async (id: string, organisationId: string) => {
  const allergy = await prisma.patientAllergy.findFirst({
    where: { id, organisationId },
    select: allergySelect,
  });
  if (!allergy) {
    throw new PatientAllergyError("Allergy record not found.", 404);
  }
  return allergy;
};

export const PatientAllergyService = {
  async create(params: CreatePatientAllergyParams) {
    const {
      organisationId,
      patientId,
      allergen,
      allergyType,
      severity,
      reaction,
      status,
      onsetDate,
      notes,
      recordedBy,
    } = params;

    const allergy = await prisma.patientAllergy.create({
      data: {
        organisationId,
        patientId,
        allergen,
        allergyType,
        severity,
        reaction: reaction ?? null,
        status: status ?? "ACTIVE",
        onsetDate: onsetDate ?? null,
        resolvedDate: null,
        notes: notes ?? null,
        recordedBy: recordedBy ?? null,
      },
      select: allergySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "ALLERGY_RECORDED",
      actorType: "PMS_USER",
      actorId: recordedBy ?? null,
      entityType: "COMPANION",
      entityId: allergy.id,
      metadata: { allergen, allergyType, severity },
    });

    return allergy;
  },

  async get(id: string, organisationId: string) {
    return assertAllergy(id, organisationId);
  },

  async list(params: ListPatientAllergiesParams) {
    const { organisationId, patientId, status, allergyType } = params;
    return prisma.patientAllergy.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
        ...(allergyType ? { allergyType } : {}),
      },
      select: allergySelect,
      orderBy: [
        { severity: "desc" },
        { allergyType: "asc" },
        { createdAt: "desc" },
      ],
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdatePatientAllergyParams,
    updatedBy?: string,
  ) {
    await assertAllergy(id, organisationId);

    const data: Prisma.PatientAllergyUpdateInput = {};
    if (params.allergen !== undefined) data.allergen = params.allergen;
    if (params.allergyType !== undefined) data.allergyType = params.allergyType;
    if (params.severity !== undefined) data.severity = params.severity;
    if (params.reaction !== undefined) data.reaction = params.reaction;
    if (params.status !== undefined) data.status = params.status;
    if (params.onsetDate !== undefined) data.onsetDate = params.onsetDate;
    if (params.resolvedDate !== undefined)
      data.resolvedDate = params.resolvedDate;
    if (params.notes !== undefined) data.notes = params.notes;

    const updated = await prisma.patientAllergy.update({
      where: { id },
      data,
      select: allergySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: updated.patientId,
      eventType: "ALLERGY_UPDATED",
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
    const allergy = await assertAllergy(id, organisationId);
    if (allergy.status === "RESOLVED") {
      throw new PatientAllergyError("Allergy is already resolved.", 409);
    }

    const updated = await prisma.patientAllergy.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedDate: resolvedDate ?? new Date(),
      },
      select: allergySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: allergy.patientId,
      eventType: "ALLERGY_RESOLVED",
      actorType: "PMS_USER",
      actorId: resolvedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { allergen: allergy.allergen },
    });

    return updated;
  },
};
